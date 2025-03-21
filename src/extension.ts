import { exec } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

const diagnosticCollection =
	vscode.languages.createDiagnosticCollection("gitleaks");

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "gitleak-vs" is now active!');

	let disposable = vscode.commands.registerCommand(
		"gitleak-vs.checkProject",
		() => {
			checkProjectForLeaks();
		},
	);

	context.subscriptions.push(disposable);
}
function checkProjectForLeaks() {
	const homeDir = os.homedir();
	const leaksDir = path.join(homeDir, '.gitleaks-vs');
	const leaksFilePath = path.join(leaksDir, 'leaks.json');

	// Создаём папку, если она не существует
	if (!fs.existsSync(leaksDir)) {
		fs.mkdirSync(leaksDir, { recursive: true });
	}

	// Получаем корневую папку проекта
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0]; // Берём первую папку из списка

	console.log(workspaceFolder);
	if (!workspaceFolder) {
		vscode.window.showErrorMessage('No workspace folder found.');
		return;
	}


	// Вызываем gitleaks и выводим результаты в .gitleaks-vs/leaks.json
	// exec(`gitleaks detect --source=${workspaceFolder.uri.fsPath} --report=${leaksFilePath}`, (error, stdout, stderr) => {
	exec(`gitleaks dir -r ${leaksFilePath} ` + workspaceFolder.uri.fsPath, (error, stdout, stderr) => {
		if (error) {
			if (error.message.includes('leaks found: ')) {
				// Вызываем метод для обработки результата
				parseGitleaksOutput(leaksFilePath);
			} else {
				console.error(`Error running gitleaks: ${error.message}`);
			}
		} else {
			// Очищаем диагностику, если утечек не найдено
			clearDiagnostics();
		}
	});
}

function parseGitleaksOutput(leaksFilePath: string) {
	fs.readFile(leaksFilePath, 'utf8', (err, data) => {
		if (err) {
			console.error(`Error reading ${leaksFilePath}: ${err}`);
			return;
		}

		try {
			const leaks = JSON.parse(data); // Парсим JSON-данные
			const diagnosticsMap: Map<string, vscode.Diagnostic[]> = new Map(); // Карта для хранения диагностики по каждому файлу

			// Обходим каждый объект в массиве leaks
			leaks.forEach((leak: any) => {
				const workspaceFolder = vscode.workspace.workspaceFolders?.[0]; // Берём первую папку из списка
				if (!workspaceFolder) {
					console.error('No workspace folder found.');
					return;
				}

				const filePath = path.join(workspaceFolder.uri.fsPath, leak.File);
				const docUri = vscode.Uri.file(filePath); // Путь к файлу

				const startLine = leak.StartLine - 1; // нумерация с нуля
				const endLine = leak.EndLine - 1; // нумерация с нуля
				const startPos = new vscode.Position(startLine, leak.StartColumn - 1);
				const endPos = new vscode.Position(endLine, leak.EndColumn);

				const range = new vscode.Range(startPos, endPos);
				const diagnostic = new vscode.Diagnostic(
					range,
					`Potential secret exposure found: ${leak.Message}`,
					vscode.DiagnosticSeverity.Warning
				);

				// Добавляем диагностику в карту, создавая новый массив, если необходимо
				if (!diagnosticsMap.has(docUri.toString())) {
					diagnosticsMap.set(docUri.toString(), []);
				}
				diagnosticsMap.get(docUri.toString())!.push(diagnostic);
			});

			// Обновление диагностики в редакторе для каждого файла
			diagnosticsMap.forEach((diagnostics, uriString) => {
				updateDiagnostics(vscode.Uri.parse(uriString), diagnostics);
			});
		} catch (parseError) {
			console.error(`Error parsing ${leaksFilePath}: ${parseError}`);
		}
	});
}
function updateDiagnostics(uri: vscode.Uri, diagnostics: vscode.Diagnostic[]) {
	diagnosticCollection.set(uri, diagnostics);
}

// Очистка сообщений о диагностике
function clearDiagnostics() {
	diagnosticCollection.clear();
}

export function deactivate() {
	diagnosticCollection.dispose();
}
