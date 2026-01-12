# Relayze

## Instant, ephemeral, & secure webhook endpoints with edge-native real-time observation

> **Real-time webhook testing and debugging at the edge**

[![GitHub Stars](https://img.shields.io/github/stars/edgefoundry/Relayze)](https://github.com/edgefoundryinc/Relayze)
[![License](https://img.shields.io/badge/license-BUSL%201.1-blue)](LICENSE)
[![Deploy](https://img.shields.io/badge/deploy-cloudflare-orange)](docs/self-hosting.md)

Relayze gives you instant webhook URLs that update in real-time via WebSockets. Built on Cloudflare's edge network for sub-50ms latency worldwide.

## Features

- **Instant URLs**: Generate webhook endpoints in milliseconds
- **Real-time updates**: See webhooks appear live via WebSocket
- **Edge processing**: Sub-50ms latency globally
- **Zero config**: No setup required, works immediately
- **Self-hostable**: Deploy to your own Cloudflare account in 5 minutes

## Quick Start

### Cloud (Fastest)
```bash
# Just visit:
https://Relayze.app
```

### Self-Hosted (Free Forever)
```bash
git clone https://github.com/edgefoundryinc/Relayze
cd Relayze
npm install
npm run deploy
```

[Full self-hosting guide →](docs/self-hosting.md)

## Why Relayze?

**vs ngrok**: No tunneling required, works at the edge
**vs RequestBin**: Real-time WebSocket updates, not polling
**vs Webhook.site**: Open source, self-hostable, faster

## Architecture

Relayze uses a breakthrough pattern: **single URLs handle both POST (receive) and GET (retrieve)**
```
POST https://Relayze.app/abc123  → Store webhook
GET  https://Relayze.app/abc123  → Retrieve webhooks
```

This is powered by Cloudflare Durable Objects for persistent edge state.

[Read the architecture docs →](docs/architecture.md)

## Use Cases

- **Stripe webhook testing**: Test payment flows locally
- **Shopify app development**: Debug order webhooks
- **GitHub Actions**: Monitor workflow events
- **API integration testing**: Validate third-party webhooks

## Development
```bash
npm install
npm run dev         # Start local dev server
npm run test        # Run tests
npm run deploy      # Deploy to Cloudflare
```

## Contributing

We love contributions! See [CONTRIBUTING.md](CONTRIBUTING.md)

## Roadmap

- [ ] Webhook forwarding
- [ ] Custom domains
- [ ] Team workspaces
- [ ] Request filtering
- [ ] Analytics dashboard

## Enterprise


## License

Business Source License 1.1 (converts to Apache 2.0 after 2 years)

This means:
- ✅ Use for free (personal or commercial)
- ✅ Self-host on your infrastructure
- ✅ Modify and customize
- ❌ Can't launch a competing hosted service

[Read full license →](LICENSE)

## Credits

Built by [@ab_edge](https://twitter.com/ab_eddge) at Edge Foundry, Inc.

---

**If you find this useful, star the repo!**

## Contributing

Relayze is licensed under BUSL 1.1. We welcome contributions!

By submitting a PR, you agree that:
- Your contribution will be licensed under BUSL 1.1
- After 4 years, it converts to Apache 2.0
- You retain copyright but grant Edge Foundry Inc. usage rights

We accept:
✅ Bug fixes
✅ Documentation improvements  
✅ Feature additions (discuss in issue first)
✅ Performance improvements

For major features, open an issue first to discuss direction.

