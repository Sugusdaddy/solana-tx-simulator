# Contributing to Solana TX Simulator

First off, thanks for taking the time to contribute! 🎉

## How to Contribute

### Reporting Bugs
- Use GitHub Issues
- Include transaction signature if applicable
- Describe expected vs actual behavior

### Adding Protocol Decoders
1. Create decoder in `src/decoders/`
2. Export from `src/decoders/index.ts`
3. Add tests in `tests/`
4. Update README with supported protocol

### Code Style
- TypeScript strict mode
- ESLint + Prettier
- Meaningful commit messages

### Pull Request Process
1. Fork the repo
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## Development Setup

```bash
git clone https://github.com/Sugusdaddy/solana-tx-simulator.git
cd solana-tx-simulator
npm install
npm run dev
```

## Questions?
Open an issue or reach out on Twitter [@Sugusdaddy](https://twitter.com/Sugusdaddy)
