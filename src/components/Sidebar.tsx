import type { IconName } from "./Icon";
import { Icon } from "./Icon";

export type NavigationId =
	| "dashboard"
	| "claims"
	| "denials"
	| "payments"
	| "ar"
	| "exceptions"
	| "interoperability"
	| "analytics"
	| "automation"
	| "hitl";

export const navigationItems: {
	id: NavigationId;
	label: string;
	icon: IconName;
	implemented: boolean;
}[] = [
	{
		id: "dashboard",
		label: "Dashboard",
		icon: "grid",
		implemented: true,
	},
	{ id: "claims", label: "Claims", icon: "claims", implemented: true },
	{ id: "denials", label: "Denials", icon: "denials", implemented: true },
	{ id: "payments", label: "Payments", icon: "payments", implemented: true },
	{ id: "ar", label: "AR Management", icon: "clock", implemented: true },
	{
		id: "exceptions",
		label: "Exceptions",
		icon: "exceptions",
		implemented: true,
	},
	{
		id: "interoperability",
		label: "Interoperability",
		icon: "interoperability",
		implemented: true,
	},
	{
		id: "analytics",
		label: "Analytics",
		icon: "analytics",
		implemented: true,
	},
	{
		id: "automation",
		label: "Automation",
		icon: "automation",
		implemented: true,
	},
	{ id: "hitl", label: "AI / HITL", icon: "hitl", implemented: true },
];

export function Sidebar({
	active,
	isOpen,
	onNavigate,
	onClose,
}: {
	active: NavigationId;
	isOpen: boolean;
	onNavigate: (id: NavigationId) => void;
	onClose: () => void;
}) {
	return (
		<>
			{isOpen ? (
				<button
					type="button"
					className="sidebar-scrim"
					aria-label="Close navigation"
					onClick={onClose}
				/>
			) : null}
			<aside className={`sidebar${isOpen ? " sidebar--open" : ""}`}>
				<a className="brand" href="#dashboard" aria-label="RyVora home">
					<span className="brand-mark" aria-hidden="true">
						R
					</span>
					<span className="brand-copy">
						<strong className="brand-name">RyVora</strong>
						<span className="brand-description">RCM OPERATIONS</span>
					</span>
				</a>
				<div className="sidebar-divider" />
				<div className="nav-label">WORKSPACE</div>
				<nav aria-label="Primary navigation">
					<ul className="nav-list">
						{navigationItems.map((item) => (
							<li key={item.id}>
								<button
									type="button"
									className={`nav-item${active === item.id ? " nav-item--active" : ""}`}
									aria-current={active === item.id ? "page" : undefined}
									onClick={() => onNavigate(item.id)}
								>
									<Icon name={item.icon} className="nav-icon" />
									<span>{item.label}</span>
									{!item.implemented ? (
										<span className="nav-soon">Soon</span>
									) : null}
								</button>
							</li>
						))}
					</ul>
				</nav>
				<div className="sidebar-bottom">
					<div className="data-status">
						<span className="data-status-dot" aria-hidden="true" />
						<div>
							<strong>Dataset connected</strong>
							<small>Approved synthetic v1.2</small>
						</div>
					</div>
					<div className="sidebar-footnote">
						Simulated portfolio environment
					</div>
				</div>
			</aside>
		</>
	);
}
