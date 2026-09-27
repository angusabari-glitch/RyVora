import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/app/App";

describe("Executive Dashboard experience", () => {
	it("renders KPI values and analytics from the approved dataset", async () => {
		render(<App />);

		expect(
			await screen.findByRole("heading", { name: "Executive Dashboard" }),
		).toBeInTheDocument();
		const kpis = screen.getByRole("region", {
			name: "Executive performance indicators",
		});
		expect(await within(kpis).findByText("$4,621,631.63")).toBeInTheDocument();
		expect(within(kpis).getByText("32.35 days")).toBeInTheDocument();
		expect(within(kpis).getByText("29.0%")).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Claim status distribution" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Denial reason analysis" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Accounts receivable profile" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Management attention" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Priority claims" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("alert", { name: /KPI validation discrepancy/i }),
		).not.toBeInTheDocument();
	});

	it("filters priority claims and sorts a visible table column", async () => {
		render(<App />);
		const filter = await screen.findByRole("combobox", {
			name: "Filter claims",
		});
		fireEvent.change(filter, { target: { value: "denied" } });
		const table = screen.getByRole("region", {
			name: "Priority claims requiring follow-up",
		});
		expect(within(table).getAllByText("Denied").length).toBeGreaterThan(0);
		fireEvent.click(within(table).getByRole("button", { name: "AR age" }));
		expect(
			within(table).getByRole("columnheader", { name: /AR age/i }),
		).toHaveAttribute("aria-sort", "ascending");
	});

	it("navigates to Claims and returns to the dashboard", async () => {
		render(<App />);
		await screen.findByRole("heading", { name: "Executive Dashboard" });
		fireEvent.click(screen.getByRole("button", { name: /Claims/ }));
		expect(
			await screen.findByRole("heading", { name: "Claims" }),
		).toBeInTheDocument();
		expect(
			screen.getByText("Showing 1–25 of 1,000 claims"),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
		expect(
			await screen.findByRole("heading", { name: "Executive Dashboard" }),
		).toBeInTheDocument();
	});

	it("opens a notification summary from the actual management alerts", async () => {
		render(<App />);
		const notificationButton = await screen.findByRole("button", {
			name: "Management alerts, 4 active",
		});
		fireEvent.click(notificationButton);
		const alertRegion = screen.getByRole("region", {
			name: "Active management alerts",
		});
		expect(
			within(alertRegion).getByText("Critical exceptions remain open"),
		).toBeInTheDocument();
		await waitFor(() =>
			expect(notificationButton).toHaveAttribute("aria-expanded", "true"),
		);
	});
});
