import { useState } from "react";
import type { ManagementAlert } from "../business/executiveDashboard";
import { Icon } from "./Icon";

export function Header({
	alerts,
	onMenuClick,
}: {
	alerts: ManagementAlert[];
	onMenuClick: () => void;
}) {
	const [alertsOpen, setAlertsOpen] = useState(false);
	return (
		<header className="topbar">
			<div className="topbar-left">
				<button
					type="button"
					className="icon-button mobile-menu-button"
					aria-label="Open navigation"
					onClick={onMenuClick}
				>
					<Icon name="menu" />
				</button>
				<div className="topbar-context">
					<div className="topbar-title">US Healthcare RCM</div>
					<div className="topbar-subtitle">Digital Transformation Platform</div>
				</div>
			</div>
			<div className="topbar-actions">
				<div className="notification-wrap">
					<button
						type="button"
						className="icon-button notification-button"
						aria-label={`Management alerts, ${alerts.length} active`}
						aria-expanded={alertsOpen}
						aria-controls="notification-popover"
						onClick={() => setAlertsOpen((open) => !open)}
					>
						<Icon name="bell" />
						{alerts.length > 0 ? (
							<span className="notification-count">{alerts.length}</span>
						) : null}
					</button>
					{alertsOpen ? (
						<section
							id="notification-popover"
							className="notification-popover"
							aria-label="Active management alerts"
						>
							<strong>Management attention</strong>
							{alerts.length === 0 ? (
								<p>No active alerts from the current dataset.</p>
							) : (
								<ul>
									{alerts.map((alert) => (
										<li key={alert.id}>
											<span
												className={`popover-dot popover-dot--${alert.severity}`}
											/>
											<span>{alert.title}</span>
											<b>{alert.count.toLocaleString("en-US")}</b>
										</li>
									))}
								</ul>
							)}
						</section>
					) : null}
				</div>
				<div className="user-context">
					<span className="user-avatar" aria-hidden="true">
						RV
					</span>
					<span className="user-copy">
						<strong>RCM Executive</strong>
						<small>Portfolio workspace</small>
					</span>
				</div>
			</div>
		</header>
	);
}
