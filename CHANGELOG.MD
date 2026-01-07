# Changelog

All notable changes to Posthook will be documented in this file.

## [0.0.2] - 2026-01-06

### Added
- **Authentication System**: Integrated Google OAuth 2.0 authentication for secure user management
- **Theme System**: Implemented comprehensive light/dark theme support with persistent user preferences
- **Dynamic Syntax Highlighting**: Context-aware code syntax highlighting that adapts to active theme (Atom One Dark / GitHub Light)
- **Responsive Design**: Mobile-first layout optimizations for tablets and mobile devices
- **Accessibility Improvements**: Enhanced keyboard navigation and ARIA labels throughout the application

### Changed
- **UI/UX Overhaul**: Redesigned core layout with improved information hierarchy and visual consistency
- **Performance Optimization**: Eliminated theme transition flashing through selective CSS transition management
- **Color System**: Decoupled component color variables for independent theming and maintainability
- **Request Display**: Enhanced active request indication with instant visual feedback

### Fixed
- Theme switching animation artifacts across navbar, tabs, code viewer, and footer components
- Request section visual coupling from footer styling
- Inconsistent spacing between UI sections
- Syntax highlighting not respecting theme changes

## [0.0.1] - 2026-01-05

### Added
- **Initial Release**: Edge-native webhook endpoint generation and real-time observation
- **WebSocket Integration**: Sub-50ms latency webhook delivery cloud computing.
- **Real-time Dashboard**: Live webhook monitoring with instant updates
- **Request History**: Persistent webhook storage with full header and payload inspection
- **Zero Configuration**: Instant webhook URL generation without setup
- **Developer Tools**: JSON prettify/raw view toggle, syntax highlighting, and request filtering

### Infrastructure
- Deployed on Cloudflare for global edge distribution
- Durable Objects for stateful, low-latency data persistence
- WebSocket support for real-time bidirectional communication
- Sub-50ms p95 latency worldwide

---

## Roadmap

### Planned Features
- Webhook forwarding and routing
- Custom domain support
- Team workspaces and collaboration
- Advanced request filtering and search
- Analytics dashboard with metrics
- Webhook replay and testing tools
- API rate limiting and quotas
- Webhook signature verification
- Custom retention policies
- Integration with CI/CD pipelines

---

**Note**: This project follows Business Source License 1.1, converting to Apache 2.0 after 2 years.