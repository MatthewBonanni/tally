# Tally

A local-first, privacy-focused personal finance application. All your financial data stays on your machine, encrypted with SQLCipher.

## Features

- **Encrypted Storage** - All data encrypted at rest using SQLCipher with Argon2id key derivation
- **Account Management** - Track checking, savings, credit cards, investments, loans, and more
- **Transaction Import** - Import from CSV files and Bank of America TXT statements
- **Auto-Categorization** - Create rules to automatically categorize transactions
- **Transfer Detection** - Automatically detect and link transfers between accounts
- **Budgets** - Set monthly budgets by category and track spending
- **Goals** - Create savings goals and track progress
- **Recurring Transactions** - Detect and manage recurring bills and income
- **Investment Tracking** - Track holdings, cost basis, and performance
- **Reports** - Visualize spending by category, cash flow, and net worth over time
- **Dark Mode** - Full dark/light theme support

## Tech Stack

### Desktop App
- **Framework**: [Tauri 2.x](https://tauri.app/) - Rust-based desktop app framework
- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Charts**: [Recharts](https://recharts.org/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Routing**: React Router v7

### Backend (Rust)
- **Database**: SQLite with [SQLCipher](https://www.zetetic.net/sqlcipher/) encryption
- **Key Derivation**: Argon2id
- **ORM**: rusqlite

## Installation

### Pre-built Releases (Recommended)

Download the latest release for your platform from the [Releases](https://github.com/yourusername/tally/releases) page:

- **macOS**: `Tally.dmg` (Universal binary for Intel and Apple Silicon)
- **Windows**: `Tally.msi` (coming soon)
- **Linux**: `Tally.AppImage` (coming soon)

### Build from Source

#### Prerequisites

- [Node.js](https://nodejs.org/) 18+ and [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/) 1.70+
- Platform-specific dependencies:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `libwebkit2gtk-4.1-dev`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`
  - **Windows**: Visual Studio Build Tools with C++ workload

#### Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/tally.git
   cd tally
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Run in development mode:
   ```bash
   pnpm tauri dev
   ```

4. Build for production:
   ```bash
   pnpm tauri build
   ```

   The built application will be in `src-tauri/target/release/bundle/`.

## Usage

### First Launch

1. Launch the app
2. Create a password - this encrypts your database
3. Start adding accounts and importing transactions

### Importing Transactions

The app supports multiple import formats:

- **CSV files** - Works with most bank exports. Map columns during import.
- **Bank of America TXT** - Directly import BoA statement text files (auto-detected).

To import:
1. Go to the Import page
2. Select your file (.csv or .txt)
3. Choose the target account
4. Review and confirm the transactions

### Data Location

Your encrypted database is stored at:
- **macOS**: `~/Library/Application Support/tally/data.db`
- **Linux**: `~/.local/share/tally/data.db`
- **Windows**: `C:\Users\<User>\AppData\Roaming\tally\data.db`

You can change this location in Settings > Advanced.

## Development

### Project Structure

```
tally/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── pages/              # Page components
│   ├── stores/             # Zustand stores
│   ├── lib/                # Utilities and API bindings
│   └── types/              # TypeScript types
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri command handlers
│   │   ├── db/             # Database connection and migrations
│   │   ├── import/         # File parsers (CSV, BoA)
│   │   └── models/         # Data models
│   └── migrations/         # SQL migrations
└── public/                 # Static assets
```

### Key Commands

```bash
# Development
pnpm tauri dev          # Run in development mode with hot reload

# Building
pnpm tauri build        # Build production app

# Frontend only
pnpm dev                # Run Vite dev server
pnpm build              # Build frontend
pnpm lint               # Run ESLint

# Rust
cargo check --manifest-path src-tauri/Cargo.toml  # Check Rust code
cargo test --manifest-path src-tauri/Cargo.toml   # Run Rust tests
```

## Security

- **Local-first**: No cloud sync, no accounts, no telemetry
- **Encrypted at rest**: SQLCipher AES-256 encryption
- **Secure key derivation**: Argon2id with memory-hard parameters
- **No network access**: The app works completely offline

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
