import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { briefFrom, completionFrom, cpuFallbackAfterGpuError, fileRuling, gpuWriteFailed, parseGithub, rulingFrom } from "./browserHearing.ts";

describe("completionFrom", () => {
  it("drops the prompt and keeps the new JSON", () => {
    const prompt = "<|im_start|>system\nYou are Lens.<|im_end|>\n<|im_start|>assistant\n";
    const full = `${prompt}{"stance":"The label is wrong.","answer":"Rename the button."}`;
    assert.equal(completionFrom(full, prompt), '{"stance":"The label is wrong.","answer":"Rename the button."}');
  });

  it("returns nothing when the model only echoed the prompt", () => {
    const prompt = "<|im_start|>user\nMatter<|im_end|>\n<|im_start|>assistant\n";
    assert.equal(completionFrom(prompt, prompt), "");
    assert.equal(completionFrom("system You are Lens.", "<|im_start|>system\nYou are Lens.<|im_end|>"), "");
  });

  it("keeps the reply when the decoder already stripped special tokens", () => {
    const prompt = "<|im_start|>system\nYou are Lens.<|im_end|>\n<|im_start|>assistant\n";
    const full = 'system\nYou are Lens.\nassistant\n{"answer":"Rename it."}';
    assert.equal(completionFrom(full, prompt), '{"answer":"Rename it."}');
  });
});

describe("cpuFallbackAfterGpuError", () => {
  it("does not start the CPU weights after a network failure", () => {
    assert.equal(cpuFallbackAfterGpuError(new TypeError("Failed to fetch")), false);
    assert.equal(cpuFallbackAfterGpuError(new Error("NetworkError when attempting to fetch resource.")), false);
    assert.equal(cpuFallbackAfterGpuError("Load failed"), false);
    assert.equal(cpuFallbackAfterGpuError(new Error("Failed to load resource: 404")), false);
  });

  it("does start the CPU weights after a GPU device failure", () => {
    assert.equal(cpuFallbackAfterGpuError(new Error("GPUPipelineError: shader-f16 is missing")), true);
    assert.equal(cpuFallbackAfterGpuError(new TypeError("requestDevice failed")), true);
    assert.equal(cpuFallbackAfterGpuError(new Error("out of memory")), true);
    assert.equal(cpuFallbackAfterGpuError(undefined), true);
    assert.equal(cpuFallbackAfterGpuError(null), true);
  });
});

describe("gpuWriteFailed", () => {
  it("does not download the CPU copy after a network miss", () => {
    assert.equal(gpuWriteFailed("Failed to fetch"), false);
    assert.equal(gpuWriteFailed(new Error("404")), false);
  });

  it("does download the CPU copy after a string abort", () => {
    assert.equal(gpuWriteFailed("Aborted(RuntimeError: memory access out of bounds)"), true);
    assert.equal(gpuWriteFailed({ message: "GPUPipelineError" }), true);
  });
});

describe("parseGithub", () => {
  it("reads an owner and repo", () => {
    assert.deepEqual(parseGithub("https://github.com/veeresh-bikkaneti/LLMcouncil"), {
      owner: "veeresh-bikkaneti",
      repo: "LLMcouncil",
    });
    assert.deepEqual(parseGithub("https://www.github.com/veeresh-bikkaneti/LLMcouncil.git"), {
      owner: "veeresh-bikkaneti",
      repo: "LLMcouncil",
    });
  });

  it("keeps a blob path and drops a traversal", () => {
    assert.deepEqual(
      parseGithub("https://github.com/veeresh-bikkaneti/LLMcouncil/blob/main/src/agents.ts"),
      { owner: "veeresh-bikkaneti", repo: "LLMcouncil", path: "src/agents.ts" },
    );
    assert.deepEqual(parseGithub("https://github.com/acme/repo/blob/main/../secrets.env"), {
      owner: "acme",
      repo: "repo",
    });
  });

  it("rejects anything that is not a public GitHub repo", () => {
    assert.equal(parseGithub("https://gitlab.com/acme/repo"), null);
    assert.equal(parseGithub("https://github.com/only-owner"), null);
    assert.equal(parseGithub("not a url"), null);
  });
});

describe("briefFrom", () => {
  it("accepts aliased keys, a string claim, and a percent", () => {
    const brief = briefFrom(
      "lens",
      '{"Answer":["The label is a heading."],"claims":"Label is a heading.","confidence":"70%"}',
    );
    assert.equal(brief.status, "done");
    assert.equal(brief.answer, "The label is a heading.");
    assert.deepEqual(brief.claims, ["Label is a heading."]);
    assert.equal(brief.confidence, 70);
  });

  it("keeps the later object when the sample is echoed", () => {
    const text = `{"stance":"Button looks like a title.","answer":"A tired person will not tap it.","claims":["Label is a heading."],"confidence":55}
{"stance":"The loop has no guard.","answer":"An empty list crashes it.","claims":["Empty list crashes the loop."],"confidence":0.8}`;
    const brief = briefFrom("stacks", text);
    assert.equal(brief.answer, "An empty list crashes it.");
    assert.equal(brief.confidence, 80);
    assert.deepEqual(brief.claims, ["Empty list crashes the loop."]);
  });

  it("repairs a trailing comma instead of dropping the claims", () => {
    const brief = briefFrom(
      "pulse",
      '{"stance":"The user is stuck.","answer":"They cannot see the next step.","claims":["The user is blocked.",],"confidence":40,}',
    );
    assert.equal(brief.answer, "They cannot see the next step.");
    assert.deepEqual(brief.claims, ["The user is blocked."]);
    assert.equal(brief.confidence, 40);
  });

  it("keeps the prose when the only object is a repo snippet", () => {
    const brief = briefFrom("lens", 'A tired person will miss the button. {"name":"council"}');
    assert.equal(brief.answer, "A tired person will miss the button.");
    assert.equal(brief.stance, "");
  });

  it("reads a seat that stopped before the closing brace", () => {
    const brief = briefFrom(
      "stacks",
      '{ "stance": "Null check is missing.", "answer": "Guard the empty list.", "next_step": "Add one guard."',
    );
    assert.equal(brief.stance, "Null check is missing.");
    assert.equal(brief.answer, "Guard the empty list.");
    assert.deepEqual(brief.claims, ["Add one guard."]);
    assert.equal(brief.answer.includes("{"), false);
  });

  it("reads four short lines when the model skips braces", () => {
    const brief = briefFrom(
      "pulse",
      "STANCE: The user is stuck.\nANSWER: They cannot see the next step.\nCLAIMS: The user is blocked | Name the next step\nCONFIDENCE: 40",
    );
    assert.equal(brief.stance, "The user is stuck.");
    assert.equal(brief.answer, "They cannot see the next step.");
    assert.deepEqual(brief.claims, ["The user is blocked", "Name the next step"]);
    assert.equal(brief.confidence, 40);
  });
});

describe("fileRuling", () => {
  it("files the hearing from seat sentences and drops braces", () => {
    const stacks = briefFrom(
      "stacks",
      '{ "stance": "Null check is missing.", "answer": "Guard the empty list.", "next_step": "Add one guard."',
    );
    const pulse = briefFrom("pulse", "The user cannot see the next step.");
    const ruling = fileRuling([stacks, pulse]);
    assert.equal(ruling.verdict.includes("{"), false);
    assert.equal(ruling.dissent.includes("{"), false);
    assert.equal(ruling.verdict.includes("unstructured"), false);
    assert.ok(ruling.verdict === "Guard the empty list." || ruling.verdict === "The user cannot see the next step.");
  });
});

describe("rulingFrom", () => {
  it("uses the answer when the chair writes a broken seat object", () => {
    const ruling = rulingFrom(
      '{ "stance": "Null check is missing.", "answer": "Guard the empty list.", "next_step": "Add one guard."',
    );
    assert.equal(ruling.verdict, "Guard the empty list.");
    assert.equal(ruling.dissent, "");
    assert.equal(ruling.verdict.includes("{"), false);
  });

  it("reads a verdict written as short lines", () => {
    const ruling = rulingFrom("VERDICT: Rename the control.\nACTIONS: Add an empty state | Retest the button\nDISSENT: Stacks wanted a code fix.");
    assert.equal(ruling.verdict, "Rename the control.");
    assert.deepEqual(ruling.actions, ["Add an empty state", "Retest the button"]);
    assert.equal(ruling.dissent, "Stacks wanted a code fix.");
  });
});
