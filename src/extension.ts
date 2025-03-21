import { exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

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
						// После выполнения gitleaks, парсим leaks.json
						highlightSecrets(doc, []); // Очищаем подсветку
						parseGitleaksOutput(doc, leaksFilePath);
						return;
					} else {
						console.error(`Error running gitleaks: ${error.message}`);
						return;
					}
				} else {
					highlightSecrets(doc, []); // Очищаем подсветку

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
			const secretRanges: vscode.Range[] = [];

			// Обходим каждый объект в массиве leaks
			leaks.forEach((leak: any) => {
				const startLine = leak.StartLine - 1; // zero-based index
				const endLine = leak.EndLine - 1; // zero-based index
				const startPos = new vscode.Position(startLine, leak.StartColumn - 1);
				const endPos = new vscode.Position(endLine, leak.EndColumn);
				secretRanges.push(new vscode.Range(startPos, endPos));
			});

			// Добавление декоратора для выделения секретов
			highlightSecrets(doc, secretRanges);
		} catch (parseError) {
			console.error(`Error parsing ${leaksFilePath}: ${parseError}`);
		}
	});
}

function highlightSecrets(doc: vscode.TextDocument, secretRanges: vscode.Range[]) {
	// Декоратор для подсветки
	const decorationType = vscode.window.createTextEditorDecorationType({
		backgroundColor: 'rgba(255, 0, 0, 0.3)', // Красный фон
		border: '1px solid red' // Красная рамка
	});

	const editor = vscode.window.activeTextEditor;
	if (editor && editor.document === doc) {
		editor.setDecorations(decorationType, secretRanges);
	}
}

export function deactivate() { }