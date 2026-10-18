# Frieren Modules Repository

## Description

This repository contains a collection of modules developed for the [Frieren ecosystem](https://github.com/xchwarze/frieren).

Modules in this repository are built using the `frieren-module-template`, designed to ensure seamless integration and consistent performance across the Frieren platform. These modules leverage modern technologies and are developed with the UMD (Universal Module Definition) standard, making them versatile for various deployment scenarios.

## Getting Started

To use a module from this repository, follow these steps:

### Installation

```bash
git clone https://github.com/xchwarze/frieren-modules
cd frieren-modules/<module-name>
yarn install
yarn build
```

Refer to the individual module directories for specific installation instructions.

### Usage

Each module comes with its own set of documentation. Please read through the `README.md` file in the respective module directory for detailed usage instructions.

### Install Linux-compatible modules into Frieren

With this repository and the Frieren `linux-port` checkout cloned side by side, install all non-system modules that declare Linux support:

```bash
node scripts/install-linux-modules.mjs --dry-run
node scripts/install-linux-modules.mjs
```

The script builds every matching module in production mode and copies its `dist/` contents to `/opt/frieren/frieren-back/modules/<module-name>`. Production mode retains the uncompressed UMD bundle required for Frieren's direct module serving. The build disables the optional bundle-analyzer server so installation continues through all modules and deployment. It expects Node.js 22+, Corepack/Yarn, and the Frieren frontend sources at `../frieren/frieren-front/src`. Use `--frontend-src` or `FRIEREN_FRONTEND_SRC` if your Frieren checkout is elsewhere, and `--target-dir` or `FRIEREN_MODULES_DIR` to override the install directory. It requests `sudo` only when the target is not writable.

The script skips modules that do not list `Linux` in `public/manifest.json`; it does not install system packages or publish modules to the remote catalog. Existing module data is not deleted. Review each module's requirements and Linux support before using it.

## Contributing

Contributions are welcome! If you have developed a module using the `frieren-module-template` and wish to share it, please follow these steps:

1. Fork the repository.
2. Create a new module or improve existing modules.
3. Submit a pull request with a comprehensive description of changes.

## License

All modules in this repository are distributed under the LGPL-3.0-only License, facilitating open-source collaboration and distribution.

## Acknowledgments

A special thanks to all contributors who have developed and maintained the modules in this repository, enhancing the capabilities of the Frieren ecosystem.
