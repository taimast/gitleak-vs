# gitleak-vs

gitleak-vs is a Visual Studio Code extension that helps you detect potential secrets in your code using [Gitleaks](https://github.com/zricethezav/gitleaks). It scans for sensitive information exposed in your codebase and highlights them within the editor, allowing you to address potential security issues promptly.

## Features

- Automatically scans the active file on save for secrets using Gitleaks.
- Highlights potential secret exposures directly in the editor.
- Supports JSON output for scanned results stored in a dedicated directory.
- Configurable activation based on your coding language (default is Python).

## Requirements

Make sure you have [Gitleaks](https://github.com/zricethezav/gitleaks) installed on your system. You can install it via Homebrew on macOS:

```bash
brew install gitleaks
```

Or download pre-built binaries for your OS from the Gitleaks GitHub releases page.

## Installation

1. Clone this repository or download the source code.
2. Open the project in Visual Studio Code.
3. Run `yarn install` to install dependencies.
4. Compile the extension with `yarn run compile`.
5. Press `F5` to start a new VS Code instance with the extension loaded.

## Usage

- Save a file in your project, and the extension will automatically run Gitleaks on it.
- If it finds potential secrets, the lines will be highlighted in the editor.
- You can view details about the leaks by hovering over the highlighted lines.

## Development

To contribute to the project, you can run the tests with:

```bash
yarn test
```

To lint the code, use:

```bash
yarn lint
