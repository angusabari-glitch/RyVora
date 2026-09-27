import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/app/App";

async function openClaims() {
	render(<App />);
	await screen.findByRole("heading", { name: "Executive Dashboard" });
	fireEvent.click(screen.getByRole("button", { name: "Claims" }));
	await screen.findByRole("heading", { name: "Claims" });
}

describe("Claims Work Queue and Claim Detail", () => {
	it("shows the calculated summary and the first page of real claims", async () => {
		await openClaims();
		expect(
			screen.getByText("Showing 1–25 of 1,000 claims"),
		).toBeInTheDocument();
		expect(
			screen.getByText("4,621,631.63", { exact: false }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("region", { name: "Claims work queue" }),
		).toBeInTheDocument();
		expect(
			screen.getAllByRole("button", { name: /^Open claim CLM/ }),
		).toHaveLength(25);
	});

	it("searches by claim ID and combines operational filters", async () => {
		await openClaims();
		fireEvent.change(
			screen.getByRole("searchbox", { name: /Search by claim ID/ }),
			{ target: { value: "clm1001" } },
		);
		expect(screen.getByText("Showing 1–1 of 1 claims")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Open claim CLM1001" }),
		).toBeInTheDocument();
		fireEvent.change(screen.getByRole("combobox", { name: "Claim Status" }), {
			target: { value: "Paid" },
		});
		expect(screen.getByText("Showing 0–0 of 0 claims")).toBeInTheDocument();
		expect(screen.getByText("No claims found")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /Clear filters/ }));
		expect(
			screen.getByText("Showing 1–25 of 1,000 claims"),
		).toBeInTheDocument();
	});

	it("sorts the complete result set and advances pagination without row overlap", async () => {
		await openClaims();
		const table = screen.getByRole("region", { name: "Claims work queue" });
		fireEvent.click(within(table).getByRole("button", { name: "Claim ID" }));
		const firstPageIds = screen
			.getAllByRole("button", { name: /^Open claim CLM/ })
			.map((button) => button.textContent);
		expect(firstPageIds[0]).toBe("CLM1001");
		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		const secondPageIds = screen
			.getAllByRole("button", { name: /^Open claim CLM/ })
			.map((button) => button.textContent);
		expect(secondPageIds[0]).toBe("CLM1026");
		expect(new Set([...firstPageIds, ...secondPageIds]).size).toBe(50);
		fireEvent.click(screen.getByRole("button", { name: "Previous" }));
		expect(
			screen
				.getAllByRole("button", { name: /^Open claim CLM/ })
				.map((button) => button.textContent),
		).toEqual(firstPageIds);
	});

	it("opens a claim detail with real linked 837, denial, AR and financial information", async () => {
		await openClaims();
		fireEvent.change(
			screen.getByRole("searchbox", { name: /Search by claim ID/ }),
			{ target: { value: "CLM1001" } },
		);
		fireEvent.click(screen.getByRole("button", { name: "Open claim CLM1001" }));
		expect(
			await screen.findByRole("heading", { name: "Claim Detail" }),
		).toBeInTheDocument();
		expect(screen.getByText("TXN11001")).toBeInTheDocument();
		expect(screen.getByText("DEN3001")).toBeInTheDocument();
		expect(
			screen.getByRole("table", { name: "Linked 835 payment records" }),
		).toBeInTheDocument();
		expect(screen.getByText("42 days")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Procedure and diagnosis codes are not columns in the approved v1.2 Claims worksheet.",
			),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /Back to Claims/ }));
		expect(
			await screen.findByRole("heading", { name: "Claims" }),
		).toBeInTheDocument();
	});

	it("shows clear states when a related payment or denial record is missing", async () => {
		await openClaims();
		fireEvent.change(
			screen.getByRole("searchbox", { name: /Search by claim ID/ }),
			{ target: { value: "CLM1002" } },
		);
		fireEvent.click(screen.getByRole("button", { name: "Open claim CLM1002" }));
		expect(
			await screen.findByText("No payment transaction available"),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /Back to Claims/ }));
		fireEvent.change(
			screen.getByRole("searchbox", { name: /Search by claim ID/ }),
			{ target: { value: "CLM1004" } },
		);
		fireEvent.click(screen.getByRole("button", { name: "Open claim CLM1004" }));
		expect(await screen.findByText("No denial record")).toBeInTheDocument();
	});
});
