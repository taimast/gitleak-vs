import { exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

const diagnosticCollection = vscode.languages.createDiagnosticCollection('gitleaks');

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "gitleak-vs" is now active!');

	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(doc => {
			const homeDir = os.homedir();
			const leaksDir = path.join(homeDir, '.gitleaks-vs');
			const leaksFilePath = path.join(leaksDir, 'leaks.json');

			// Создаём папку, если она не существует
			if (!fs.existsSync(leaksDir)) {
				fs.mkdirSync(leaksDir, { recursive: true });
			}
			// Вызываем gitleaks и выводим результаты в .gitleaks-vs/leaks.json
			exec(`gitleaks dir -r ${leaksFilePath} ` + doc.uri.fsPath, (error, stdout, stderr) => {
				if (error) {
					if (error.message.includes('leaks found: ')) {
						parseGitleaksOutput(doc, leaksFilePath);
						return;
					} else {
						console.error(`Error running gitleaks: ${error.message}`);
						return;
					}
				} else {
					clearDiagnostics(doc);
				}
			});
		})
	);
}

function parseGitleaksOutput(doc: vscode.TextDocument, leaksFilePath: string) {
	// Читаем содержимое файла leaks.json
	fs.readFile(leaksFilePath, 'utf8', (err, data) => {
		if (err) {
			console.error(`Error reading ${leaksFilePath}: ${err}`);
			return;
		}

		try {
			const leaks = JSON.parse(data); // Парсим JSON-данные
			const diagnostics: vscode.Diagnostic[] = [];

			// Обходим каждый объект в массиве leaks
			leaks.forEach((leak: any) => {
				const startLine = leak.StartLine - 1; // zero-based index
				const endLine = leak.EndLine - 1; // zero-based index
				const startPos = new vscode.Position(startLine, leak.StartColumn - 1);
				const endPos = new vscode.Position(endLine, leak.EndColumn);

				const range = new vscode.Range(startPos, endPos);
				const diagnostic = new vscode.Diagnostic(
					range,
					`Potential secret exposure found: ${leak.Message}`,
					vscode.DiagnosticSeverity.Warning
				);

				diagnostics.push(diagnostic);
			});

			// Обновление диагностики в редакторе
			updateDiagnostics(doc.uri, diagnostics);
		} catch (parseError) {
			console.error(`Error parsing ${leaksFilePath}: ${parseError}`);
		}
	});
}

function updateDiagnostics(uri: vscode.Uri, diagnostics: vscode.Diagnostic[]) {
	diagnosticCollection.set(uri, diagnostics);
}

function clearDiagnostics(doc: vscode.TextDocument) {
	diagnosticCollection.set(doc.uri, []);
}

export function deactivate() {
	diagnosticCollection.dispose();
}