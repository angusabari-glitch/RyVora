export type IconName =
	| "activity"
	| "alert"
	| "analytics"
	| "arrow"
	| "automation"
	| "bell"
	| "claims"
	| "clock"
	| "denials"
	| "dollar"
	| "exceptions"
	| "filter"
	| "grid"
	| "hitl"
	| "interoperability"
	| "menu"
	| "payments"
	| "search"
	| "traceability";

const iconPaths: Record<IconName, string> = {
	activity: "M3 12h4l3-8 4 16 3-8h4",
	alert: "M12 3 2.8 20h18.4L12 3Zm0 6v5m0 3h.01",
	analytics: "M4 19V5m0 14h17M8 15l3-4 3 2 5-7",
	arrow: "M7 17 17 7M8 7h9v9",
	automation:
		"M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1M12 9v6m-3-3h6",
	bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4",
	claims:
		"M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 0v5h5M9 13h6m-6 4h6",
	clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-16v6l4 2",
	denials: "M12 3 2.8 20h18.4L12 3Zm0 6v5m0 3h.01",
	dollar: "M12 2v20m5-16H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
	exceptions: "M12 3 2.8 20h18.4L12 3Zm0 6v5m0 3h.01",
	filter: "M4 6h16M7 12h10m-7 6h4",
	grid: "M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z",
	hitl: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v4m0 4h.01M8 2v3m8-3v3",
	interoperability: "M7 7h10M7 17h10M5 7l2-2 2 2m8 10 2 2 2-2M12 7v10",
	menu: "M4 6h16M4 12h16M4 18h16",
	payments: "M3 6h18v12H3zM3 10h18m-14 4h4",
	search: "m20 20-4.5-4.5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
	traceability: "M4 4h16v16H4zM8 8h8m-8 4h8m-8 4h5",
};

export function Icon({
	name,
	className,
}: {
	name: IconName;
	className?: string;
}) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			fill="none"
			focusable="false"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="1.7"
			viewBox="0 0 24 24"
		>
			<path d={iconPaths[name]} />
		</svg>
	);
}
