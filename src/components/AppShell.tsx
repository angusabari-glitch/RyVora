import type { PropsWithChildren } from "react";
import { useState } from "react";
import type { ManagementAlert } from "../business/executiveDashboard";
import { Header } from "./Header";
import type { NavigationId } from "./Sidebar";
import { Sidebar } from "./Sidebar";

export function AppShell({
	children,
	activeNavigation,
	onNavigate,
	alerts,
}: PropsWithChildren<{
	activeNavigation: NavigationId;
	onNavigate: (id: NavigationId) => void;
	alerts: ManagementAlert[];
}>) {
	const [menuOpen, setMenuOpen] = useState(false);
	function navigate(id: NavigationId) {
		onNavigate(id);
		setMenuOpen(false);
	}
	return (
		<div className="app-frame">
			<Sidebar
				active={activeNavigation}
				isOpen={menuOpen}
				onNavigate={navigate}
				onClose={() => setMenuOpen(false)}
			/>
			<div className="shell-main">
				<Header alerts={alerts} onMenuClick={() => setMenuOpen(true)} />
				<main id="main-content" className="main-content" tabIndex={-1}>
					<div className="portfolio-notice">
						<span className="portfolio-notice-dot" aria-hidden="true" />
						<strong>SIMULATED PORTFOLIO</strong>
						<span>Synthetic / non-PHI data</span>
						<span className="notice-separator" aria-hidden="true">
							·
						</span>
						<span>Not a production healthcare system</span>
					</div>
					{children}
				</main>
				<footer className="footer">
					<span>RyVora</span>
					<span>US Healthcare RCM Digital Transformation Platform</span>
					<span className="footer-version">Synthetic dataset v1.2</span>
				</footer>
			</div>
		</div>
	);
}
