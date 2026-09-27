import type { PropsWithChildren } from "react";

export function ChartContainer({
	title,
	description,
	children,
	className = "",
}: PropsWithChildren<{
	title: string;
	description?: string;
	className?: string;
}>) {
	return (
		<section className={`panel chart-panel ${className}`}>
			<div className="chart-heading">
				<h2>{title}</h2>
				{description ? <p>{description}</p> : null}
			</div>
			{children}
		</section>
	);
}
