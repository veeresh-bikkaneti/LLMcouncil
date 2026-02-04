import * as path from 'path';
import Mocha from 'mocha';
import { readdirSync, statSync } from 'fs';

function getAllTestFiles(dir: string, fileList: string[] = []): string[] {
    const files = readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);

        if (statSync(filePath).isDirectory()) {
            getAllTestFiles(filePath, fileList);
        } else if (file.endsWith('.test.js')) {
            fileList.push(filePath);
        }
    });

    return fileList;
}

export function run(): Promise<void> {
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((resolve, reject) => {
        try {
            const testFiles = getAllTestFiles(testsRoot);

            testFiles.forEach((file: string) => mocha.addFile(file));

            mocha.run((failures: number) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        } catch (err) {
            console.error(err);
            reject(err);
        }
    });
}
