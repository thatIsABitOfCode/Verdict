import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import AdminLayout from "./components/AdminLayout";
import VerdictAIAssistant from "./components/VerdictAIAssistant";

import { VerdictAIProvider } from "./context/VerdictAIContext";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Terms from "./pages/Terms";
import FullTerms from "./pages/FullTerms";
import Privacy from "./pages/Privacy";

import Home from "./pages/Home";
import MyMatters from "./pages/MyMatters";
import StartMatter from "./pages/StartMatter";
import MatterOverview from "./pages/MatterOverview";
import Evidence from "./pages/Evidence";
import Timeline from "./pages/Timeline";
import Calendar from "./pages/Calendar";
import KnowYourRights from "./pages/KnowYourRights";
import FindHelp from "./pages/FindHelp";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import Notifications from "./pages/Notifications";
import VerdictAI from "./pages/VerdictAI";
import Guidance from "./pages/Guidance";
import CaseSummary from "./pages/CaseSummary";
import RightsTopic from "./pages/RightsTopic";
import LegalIssue from "./pages/LegalIssue";

import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminSupport from "./pages/AdminSupport";
import AdminLegalKnowledge from "./pages/AdminLegalKnowledge";
import AdminReferrals from "./pages/AdminReferrals";
import AdminActivity from "./pages/AdminActivity";
import AdminAIHealth from "./pages/AdminAIHealth";
import AdminSettings from "./pages/AdminSettings";

function App() {
  return (
    <VerdictAIProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/terms/full" element={<FullTerms />} />
        <Route path="/privacy" element={<Privacy />} />

        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        <Route
          path="/matters"
          element={
            <ProtectedRoute>
              <MyMatters />
            </ProtectedRoute>
          }
        />

        <Route
          path="/matters/new"
          element={
            <ProtectedRoute>
              <StartMatter />
            </ProtectedRoute>
          }
        />

        <Route path="/matters/new/overview" element={<ProtectedRoute><MatterOverview /></ProtectedRoute>} />
<Route path="/matters/new/evidence" element={<ProtectedRoute><Evidence /></ProtectedRoute>} />
<Route path="/matters/new/timeline" element={<ProtectedRoute><Timeline /></ProtectedRoute>} />
<Route path="/matters/new/guidance" element={<ProtectedRoute><Guidance /></ProtectedRoute>} />
<Route path="/matters/:matterId/edit" element={<ProtectedRoute><StartMatter /></ProtectedRoute>} />
<Route path="/matters/:matterId/summary" element={<ProtectedRoute><CaseSummary /></ProtectedRoute>} />

        <Route
          path="/matters/:matterId"
          element={
            <ProtectedRoute>
              <MatterOverview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/matters/:matterId/evidence"
          element={
            <ProtectedRoute>
              <Evidence />
            </ProtectedRoute>
          }
        />

        <Route
          path="/matters/:matterId/timeline"
          element={
            <ProtectedRoute>
              <Timeline />
            </ProtectedRoute>
          }
        />

        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <Calendar />
            </ProtectedRoute>
          }
        />

        <Route
          path="/know-your-rights"
          element={
            <ProtectedRoute>
              <KnowYourRights />
            </ProtectedRoute>
          }
        />

        <Route
          path="/find-help"
          element={
            <ProtectedRoute>
              <FindHelp />
            </ProtectedRoute>
          }
        />
        <Route path="/help" element={<ProtectedRoute><FindHelp /></ProtectedRoute>} />
<Route path="/rights" element={<ProtectedRoute><KnowYourRights /></ProtectedRoute>} />
<Route path="/rights/:topicId" element={<ProtectedRoute><RightsTopic /></ProtectedRoute>} />
<Route path="/rights/:domainSlug/:issueSlug" element={<ProtectedRoute><LegalIssue /></ProtectedRoute>} />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/support"
          element={
            <ProtectedRoute>
              <Support />
            </ProtectedRoute>
          }
        />

        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />

        <Route
          path="/verdict-ai"
          element={
            <ProtectedRoute>
              <VerdictAI />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="support" element={<AdminSupport />} />
          <Route
            path="legal-knowledge"
            element={<AdminLegalKnowledge />}
          />
          <Route path="referrals" element={<AdminReferrals />} />
          <Route path="activity" element={<AdminActivity />} />
          <Route path="ai-health" element={<AdminAIHealth />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      <VerdictAIAssistant />
    </VerdictAIProvider>
  );
}

export default App;
