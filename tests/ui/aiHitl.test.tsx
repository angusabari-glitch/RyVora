import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAIHITLRecords, summarizeAIHITL } from "../../src/business/aiHitl";
import type { DenialRecord, HumanReview } from "../../src/business/denials";
import { AIHITLPage } from "../../src/pages/AIHITLPage";
import { loadAIHITL } from "../../src/services/aiHitlService";

vi.mock("../../src/services/aiHitlService", () => ({ loadAIHITL: vi.fn() }));

function denial(id: string, withReview: boolean): DenialRecord {
	const reviews: HumanReview[] = withReview
		? [
				{
					id: `HR-${id}`,
					reviewerRole: "RCM Analyst",
					decision: "Override",
					override: "Yes",
					overrideReason: "Additional claim context",
					reviewDate: "2026-03-04",
					finalAction: "Escalate for specialist review",
				},
			]
		: [];
	return {
		denialId: `DN-${id}`,
		claimId: `CL-${id}`,
		claim: null,
		code: "CO-16",
		reason: "Missing information",
		category: "Administrative",
		deniedAmount: 90,
		date: "2026-03-01",
		appealStatus: "Pending",
		correctiveAction: null,
		resolutionStatus: "Open",
		legacyRecommendation: null,
		legacyConfidence: null,
		aiRecommendation: {
			id: `AI-${id}`,
			claimId: `CL-${id}`,
			text: `Review source ${id}`,
			confidence: 0.83,
			type: "Review",
			status: withReview ? "Reviewed" : "Reviewed",
			generatedDate: "2026-03-03",
		},
		humanReviews: reviews,
		followUpRequired: true,
		reviewStatus: withReview ? "Reviewed" : "Pending",
	};
}

function data() {
	const recommendations = buildAIHITLRecords([
		denial("1", true),
		denial("2", false),
	]);
	return {
		version: "1.2",
		recommendations,
		summary: summarizeAIHITL(recommendations),
	};
}

const props = {
	recommendationId: null,
	onOpenRecommendation: vi.fn(),
	onBack: vi.fn(),
	onOpenDenial: vi.fn(),
	onOpenClaim: vi.fn(),
};

describe("AIHITLPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(loadAIHITL).mockResolvedValue(data());
	});

	it("renders source-based KPIs, recommendation analysis, both queues, and the boundary note", async () => {
		render(<AIHITLPage {...props} />);
		expect(
			await screen.findByRole("heading", { name: "AI / HITL" }),
		).toBeInTheDocument();
		expect(screen.getByText("AI Recommendations")).toBeInTheDocument();
		expect(screen.getByText("Pending Human Review")).toBeInTheDocument();
		expect(screen.getByText("Reviewed Coverage")).toBeInTheDocument();
		expect(
			screen.getAllByRole("region", { name: "AI recommendation queue" }),
		).toHaveLength(2);
		expect(
			screen.getByRole("region", { name: "Human review queue" }),
		).toBeInTheDocument();
		expect(screen.getByText(/source status discrepancy/)).toBeInTheDocument();
	});

	it("filters and searches the recommendation queue", async () => {
		render(<AIHITLPage {...props} />);
		await screen.findByRole("heading", { name: "AI / HITL" });
		fireEvent.change(screen.getByLabelText("Search recommendations"), {
			target: { value: "CL-2" },
		});
		expect(screen.getAllByText("AI-2").length).toBeGreaterThan(0);
		expect(screen.queryAllByText("AI-1")).toHaveLength(0);
		fireEvent.change(screen.getByLabelText("Search recommendations"), {
			target: { value: "" },
		});
		fireEvent.change(screen.getByLabelText("Human review status"), {
			target: { value: "Pending" },
		});
		expect(screen.getAllByText("AI-2").length).toBeGreaterThan(0);
		expect(screen.queryAllByText("AI-1")).toHaveLength(0);
	});

	it("opens recommendation detail and keeps AI text separate from human review", async () => {
		const onOpenRecommendation = vi.fn();
		render(
			<AIHITLPage {...props} onOpenRecommendation={onOpenRecommendation} />,
		);
		fireEvent.click(
			await screen.findByRole("button", { name: "Open recommendation AI-1" }),
		);
		expect(onOpenRecommendation).toHaveBeenCalledWith("AI-1");
		render(<AIHITLPage {...props} recommendationId="AI-1" />);
		expect(await screen.findByText("Review source 1")).toBeInTheDocument();
		expect(screen.getByText("Human Review & Decision")).toBeInTheDocument();
		expect(screen.getAllByText("Override").length).toBeGreaterThan(0);
		expect(screen.getByText("RCM Analyst")).toBeInTheDocument();
		expect(
			screen.getByText(/Audit_Trail is not projected/),
		).toBeInTheDocument();
	});

	it("exposes source-linked denial and claim drill-downs", async () => {
		const record = data().recommendations[0];
		if (!record) throw new Error("Expected synthetic recommendation fixture");
		const denialWithClaim = {
			...record.denial,
			claim: {
				claimId: "CL-1",
				patientId: "SYN-P-1",
				providerId: "SYN-PR-1",
				providerName: null,
				payerId: "P1",
				payerName: "Synthetic Payer",
				serviceDate: null,
				submissionDate: null,
				claimType: null,
				insuranceType: null,
				billedAmount: 100,
				allowedAmount: null,
				paidAmount: null,
				outstandingAmount: 100,
				status: "Denied",
				arStatus: null,
				arAge: 30,
				priority: "High",
				followUpRequired: true,
				nextAction: null,
				currentOwner: null,
				arAgingBucket: "31-60",
				transaction837: null,
				payments: [],
				denial: null,
			},
		};
		const detailRecords = buildAIHITLRecords([denialWithClaim]);
		const detailData = {
			version: "1.2",
			recommendations: detailRecords,
			summary: summarizeAIHITL(detailRecords),
		};
		render(
			<AIHITLPage
				{...props}
				recommendationId="AI-1"
				loadData={() => Promise.resolve(detailData)}
			/>,
		);
		fireEvent.click(await screen.findByRole("button", { name: "Open Denial" }));
		fireEvent.click(screen.getByRole("button", { name: "Open Claim" }));
		expect(props.onOpenDenial).toHaveBeenCalledWith("DN-1");
		expect(props.onOpenClaim).toHaveBeenCalledWith("CL-1");
	});

	it("handles empty data and recoverable service errors", async () => {
		vi.mocked(loadAIHITL).mockResolvedValueOnce({
			version: "1.2",
			recommendations: [],
			summary: summarizeAIHITL([]),
		});
		const { unmount } = render(<AIHITLPage {...props} />);
		expect(
			await screen.findByText("No AI/HITL data is available for this analysis"),
		).toBeInTheDocument();
		unmount();
		vi.mocked(loadAIHITL).mockRejectedValueOnce(
			new Error("Approved source unavailable"),
		);
		render(<AIHITLPage {...props} />);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Approved source unavailable",
		);
		expect(
			screen.getByRole("button", { name: "Try again" }),
		).toBeInTheDocument();
	});
});
