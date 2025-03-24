import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

const diagnosticCollection = vscode.languages.createDiagnosticCollection("gitleaks");

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "gitleak-vs" is now active!');

	let disposable = vscode.commands.registerCommand("gitleak-vs.checkProject", () => {
		checkProjectForLeaks();
	});

	context.subscriptions.push(disposable);
}

function checkProjectForLeaks() {
	// Получаем корневую папку проекта
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0]; // Берем первую папку

	if (!workspaceFolder) {
		vscode.window.showErrorMessage("No workspace folder found.");
		return;
	}

	const leaksDir = path.join(workspaceFolder.uri.fsPath, ".gitleaks-vs"); // Путь в текущем рабочем пространстве
	const leaksFilePath = path.join(leaksDir, "leaks.json");

	// Создаем папку, если она не существует
	if (!fs.existsSync(leaksDir)) {
		fs.mkdirSync(leaksDir, { recursive: true });
	}

	const command = `gitleaks dir -r ${leaksFilePath} ${workspaceFolder.uri.fsPath}`;

	console.log(`Running command: ${command}`);
	// Используем withProgress для отображения индикатора загрузки
	vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: "Checking project for leaks",
		cancellable: false,
	}, async (progress) => {
		progress.report({ message: "Running gitleaks..." });

		try {
			await new Promise<void>((resolve, reject) => {
				exec(command, (error) => {
					if (error) {
						if (error.message.includes("leaks found: ")) {
							clearDiagnostics();
							// Вызываем метод для обработки результата
							parseGitleaksOutput(leaksFilePath);
							resolve(); // Завершить успешное выполнение, даже если есть утечки
						} else {
							console.error(`Error running gitleaks: ${error.message}`);
							vscode.window.showErrorMessage(`Error running gitleaks: ${error.message}`);
							reject(new Error(error.message));
						}
					} else {
						clearDiagnostics();
						resolve(); // Успешное завершение без ошибок
					}
				});
			});
			vscode.window.showInformationMessage("Project check completed!");
		} catch (err) {
			console.error("An error occurred during the check: ", err);
			vscode.window.showErrorMessage("Error checking project.");
		}
	});
}

function parseGitleaksOutput(leaksFilePath: string) {
	fs.readFile(leaksFilePath, "utf8", (err, data) => {
		if (err) {
			console.error(`Error reading ${leaksFilePath}: ${err}`);
			return;
		}

		try {
			const leaks = JSON.parse(data);
			const diagnosticsMap: Map<string, vscode.Diagnostic[]> = new Map();

			const workspaceFolder = vscode.workspace.workspaceFolders?.[0]; // Получаем первую папку из списка
			if (!workspaceFolder) {
				console.error("No workspace folder found.");
				return;
			}

			const workspacePath = workspaceFolder.uri.fsPath; // Физический путь к корню рабочего пространства

			let leaksCount = leaks.length;

			leaks.forEach((leak: any) => {
				const absoluteFilePath = leak.File; // Обратите внимание, что это абсолютный путь

				// Получаем относительный путь от рабочего пространства
				const relativeFilePath = path.relative(workspacePath, absoluteFilePath);

				const fullPath = path.join(workspacePath, relativeFilePath); // Строим полный путь
				const docUri = vscode.Uri.file(fullPath); // Путь к файлу, который будет храниться в диагностике
				const startLine = leak.StartLine - 1; // Нумерация с нуля
				const endLine = leak.EndLine - 1; // Нумерация с нуля
				const startPos = new vscode.Position(startLine, leak.StartColumn - 1);
				const endPos = new vscode.Position(endLine, leak.EndColumn);

				const range = new vscode.Range(startPos, endPos);
				const diagnostic = new vscode.Diagnostic(
					range,
					`${leak.Description || 'No description available.'}`, // Добавлено поле Description
					vscode.DiagnosticSeverity.Warning,
				);

				// Используем относительный путь для создания ключа в diagnosticsMap
				if (!diagnosticsMap.has(docUri.toString())) {
					diagnosticsMap.set(docUri.toString(), []);
				}
				// Добавляем диагностику
				diagnosticsMap.get(docUri.toString())!.push(diagnostic);
			});

			// Обновление диагностики в редакторе для каждого файла
			diagnosticsMap.forEach((diagnostics, uriString) => {
				console.log(`Updating diagnostics for ${uriString}`);
				updateDiagnostics(vscode.Uri.parse(uriString), diagnostics);
			});
			// Вывод общего количества найденных утечек
			if (leaksCount > 0) {
				vscode.window.showInformationMessage(`Found ${leaksCount} leaks.`);
			} else {
				vscode.window.showInformationMessage("No leaks found.");
			}
		} catch (parseError) {
			console.error(`Error parsing ${leaksFilePath}: ${parseError}`);
		}
	});
}

function updateDiagnostics(uri: vscode.Uri, diagnostics: vscode.Diagnostic[]) {
	diagnosticCollection.set(uri, diagnostics);
}

function clearDiagnostics() {
	diagnosticCollection.clear();
}

export function deactivate() {
	diagnosticCollection.dispose();
}