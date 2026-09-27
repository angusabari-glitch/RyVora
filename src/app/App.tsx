import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import type { AutomationModule } from "../business/automation";
import type {
	ExecutiveDashboardModel,
	ManagementAlert,
} from "../business/executiveDashboard";
import { AppShell } from "../components/AppShell";
import { LoadingState } from "../components/LoadingState";
import type { NavigationId } from "../components/Sidebar";
import { navigationItems } from "../components/Sidebar";
import { UpcomingPage } from "../pages/UpcomingPage";

const ExecutiveDashboardPage = lazy(() =>
	import("../pages/ExecutiveDashboardPage").then((module) => ({
		default: module.ExecutiveDashboardPage,
	})),
);
const ClaimsPage = lazy(() =>
	import("../pages/ClaimsPage").then((module) => ({
		default: module.ClaimsPage,
	})),
);
const DenialsPage = lazy(() =>
	import("../pages/DenialsPage").then((module) => ({
		default: module.DenialsPage,
	})),
);
const PaymentsPage = lazy(() =>
	import("../pages/PaymentsPage").then((module) => ({
		default: module.PaymentsPage,
	})),
);
const ARManagementPage = lazy(() =>
	import("../pages/ARManagementPage").then((module) => ({
		default: module.ARManagementPage,
	})),
);
const ExceptionsPage = lazy(() =>
	import("../pages/ExceptionsPage").then((module) => ({
		default: module.ExceptionsPage,
	})),
);
const InteroperabilityPage = lazy(() =>
	import("../pages/InteroperabilityPage").then((module) => ({
		default: module.InteroperabilityPage,
	})),
);
const AnalyticsPage = lazy(() =>
	import("../pages/AnalyticsPage").then((module) => ({
		default: module.AnalyticsPage,
	})),
);
const AutomationPage = lazy(() =>
	import("../pages/AutomationPage").then((module) => ({
		default: module.AutomationPage,
	})),
);
const AIHITLPage = lazy(() =>
	import("../pages/AIHITLPage").then((module) => ({
		default: module.AIHITLPage,
	})),
);

function readInteroperabilityRoute() {
	const match = window.location.pathname.match(
		/^\/interoperability(?:\/([^/]+))?\/?$/,
	);
	if (!match?.[1]) return null;
	try {
		return decodeURIComponent(match[1]);
	} catch {
		return null;
	}
}

function readAutomationRoute() {
	const match = window.location.pathname.match(
		/^\/automation(?:\/([^/]+))?\/?$/,
	);
	if (!match?.[1]) return null;
	try {
		return decodeURIComponent(match[1]);
	} catch {
		return null;
	}
}

function readAIHITLRoute() {
	const match = window.location.pathname.match(/^\/ai-hitl(?:\/([^/]+))?\/?$/);
	if (!match?.[1]) return null;
	try {
		return decodeURIComponent(match[1]);
	} catch {
		return null;
	}
}

function readNavigation(): NavigationId {
	const path = window.location.pathname;
	if (path.startsWith("/interoperability")) return "interoperability";
	if (path.startsWith("/analytics")) return "analytics";
	if (path.startsWith("/automation")) return "automation";
	if (path.startsWith("/ai-hitl")) return "hitl";
	return "dashboard";
}

export function App() {
	const [activeNavigation, setActiveNavigation] =
		useState<NavigationId>(readNavigation);
	const [transactionToOpen, setTransactionToOpen] = useState<string | null>(
		readInteroperabilityRoute,
	);
	const [alerts, setAlerts] = useState<ManagementAlert[]>([]);
	const [claimToOpen, setClaimToOpen] = useState<string | null>(null);
	const [paymentToOpen, setPaymentToOpen] = useState<string | null>(null);
	const [denialToOpen, setDenialToOpen] = useState<string | null>(null);
	const [arToOpen, setArToOpen] = useState<string | null>(null);
	const [automationWorkflowToOpen, setAutomationWorkflowToOpen] = useState<
		string | null
	>(readAutomationRoute);
	const [aiRecommendationToOpen, setAIRecommendationToOpen] = useState<
		string | null
	>(readAIHITLRoute);
	const onModelLoaded = useCallback((model: ExecutiveDashboardModel) => {
		setAlerts(model.managementAlerts);
	}, []);
	const selectedItem = navigationItems.find(
		(item) => item.id === activeNavigation,
	);
	const navigate = useCallback((id: NavigationId) => {
		setActiveNavigation(id);
		setTransactionToOpen(null);
		setAutomationWorkflowToOpen(null);
		if (id === "interoperability") {
			window.history.pushState({}, "", "/interoperability");
		} else if (id === "analytics") {
			window.history.pushState({}, "", "/analytics");
		} else if (id === "automation") {
			window.history.pushState({}, "", "/automation");
		} else if (id === "hitl") {
			window.history.pushState({}, "", "/ai-hitl");
		} else if (
			window.location.pathname.startsWith("/interoperability") ||
			window.location.pathname.startsWith("/analytics") ||
			window.location.pathname.startsWith("/automation") ||
			window.location.pathname.startsWith("/ai-hitl")
		) {
			window.history.pushState({}, "", "/");
		}
	}, []);
	const openAutomationWorkflow = useCallback((workflowId: string) => {
		setAutomationWorkflowToOpen(workflowId);
		setActiveNavigation("automation");
		window.history.pushState(
			{},
			"",
			`/automation/${encodeURIComponent(workflowId)}`,
		);
	}, []);
	const openAIRecommendation = useCallback((recommendationId: string) => {
		setAIRecommendationToOpen(recommendationId);
		setActiveNavigation("hitl");
		window.history.pushState(
			{},
			"",
			`/ai-hitl/${encodeURIComponent(recommendationId)}`,
		);
	}, []);
	const openAutomationModule = useCallback(
		(module: AutomationModule) => {
			const destination: Record<AutomationModule, NavigationId> = {
				Claims: "claims",
				Denials: "denials",
				Payments: "payments",
				"AR Management": "ar",
				Exceptions: "exceptions",
				Interoperability: "interoperability",
			};
			navigate(destination[module]);
		},
		[navigate],
	);
	const openInteroperabilityTransaction = useCallback(
		(transactionId: string) => {
			setTransactionToOpen(transactionId);
			window.history.pushState(
				{},
				"",
				`/interoperability/${encodeURIComponent(transactionId)}`,
			);
		},
		[],
	);
	const openClaim = useCallback(
		(claimId: string) => {
			setClaimToOpen(claimId);
			navigate("claims");
		},
		[navigate],
	);
	useEffect(() => {
		function restoreRoute() {
			setActiveNavigation(readNavigation());
			setTransactionToOpen(readInteroperabilityRoute());
			setAutomationWorkflowToOpen(readAutomationRoute());
			setAIRecommendationToOpen(readAIHITLRoute());
		}
		window.addEventListener("popstate", restoreRoute);
		return () => window.removeEventListener("popstate", restoreRoute);
	}, []);
	useEffect(() => {
		document.title = `${selectedItem?.label ?? "RyVora"} | RyVora`;
	}, [selectedItem?.label]);

	return (
		<AppShell
			activeNavigation={activeNavigation}
			onNavigate={navigate}
			alerts={alerts}
		>
			{activeNavigation === "dashboard" ? (
				<Suspense fallback={<LoadingState label="Loading dashboard" />}>
					<ExecutiveDashboardPage onModelLoaded={onModelLoaded} />
				</Suspense>
			) : activeNavigation === "claims" ? (
				<Suspense fallback={<LoadingState label="Loading claims" />}>
					<ClaimsPage
						initialClaimId={claimToOpen}
						onInitialClaimHandled={() => setClaimToOpen(null)}
					/>
				</Suspense>
			) : activeNavigation === "denials" ? (
				<Suspense fallback={<LoadingState label="Loading denials" />}>
					<DenialsPage
						initialDenialId={denialToOpen}
						onInitialDenialHandled={() => setDenialToOpen(null)}
						onOpenClaim={openClaim}
					/>
				</Suspense>
			) : activeNavigation === "payments" ? (
				<Suspense fallback={<LoadingState label="Loading payments" />}>
					<PaymentsPage
						initialPaymentId={paymentToOpen}
						onInitialPaymentHandled={() => setPaymentToOpen(null)}
						onOpenClaim={openClaim}
					/>
				</Suspense>
			) : activeNavigation === "ar" ? (
				<Suspense fallback={<LoadingState label="Loading AR Management" />}>
					<ARManagementPage
						initialArId={arToOpen}
						onInitialArHandled={() => setArToOpen(null)}
						onOpenClaim={openClaim}
					/>
				</Suspense>
			) : activeNavigation === "exceptions" ? (
				<Suspense fallback={<LoadingState label="Loading exceptions" />}>
					<ExceptionsPage
						onOpenClaim={openClaim}
						onOpenPayment={(paymentId) => {
							setPaymentToOpen(paymentId);
							setActiveNavigation("payments");
						}}
						onOpenDenial={(denialId) => {
							setDenialToOpen(denialId);
							setActiveNavigation("denials");
						}}
						onOpenAr={(arId) => {
							setArToOpen(arId);
							setActiveNavigation("ar");
						}}
					/>
				</Suspense>
			) : activeNavigation === "interoperability" ? (
				<Suspense fallback={<LoadingState label="Loading interoperability" />}>
					<InteroperabilityPage
						transactionId={transactionToOpen}
						onOpenTransaction={openInteroperabilityTransaction}
						onBackToQueue={() => {
							setTransactionToOpen(null);
							window.history.pushState({}, "", "/interoperability");
						}}
						onOpenClaim={openClaim}
					/>
				</Suspense>
			) : activeNavigation === "analytics" ? (
				<Suspense fallback={<LoadingState label="Loading analytics" />}>
					<AnalyticsPage onOpenClaim={openClaim} />
				</Suspense>
			) : activeNavigation === "automation" ? (
				<Suspense fallback={<LoadingState label="Loading automation" />}>
					<AutomationPage
						workflowId={automationWorkflowToOpen}
						onOpenWorkflow={openAutomationWorkflow}
						onBack={() => {
							setAutomationWorkflowToOpen(null);
							window.history.pushState({}, "", "/automation");
						}}
						onOpenModule={openAutomationModule}
						onOpenClaim={openClaim}
					/>
				</Suspense>
			) : activeNavigation === "hitl" ? (
				<Suspense fallback={<LoadingState label="Loading AI / HITL" />}>
					<AIHITLPage
						recommendationId={aiRecommendationToOpen}
						onOpenRecommendation={openAIRecommendation}
						onBack={() => {
							setAIRecommendationToOpen(null);
							window.history.pushState({}, "", "/ai-hitl");
						}}
						onOpenDenial={(denialId) => {
							setDenialToOpen(denialId);
							setAIRecommendationToOpen(null);
							navigate("denials");
						}}
						onOpenClaim={openClaim}
					/>
				</Suspense>
			) : (
				<UpcomingPage title={selectedItem?.label ?? "Workspace"} />
			)}
		</AppShell>
	);
}
