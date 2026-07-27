import { Navigate, Outlet, Route, Routes } from 'react-router-dom'

import { AppShell } from './ui/layout/AppShell'
import { LoginPage } from './ui/pages/LoginPage'
import { RegisterPage } from './ui/pages/RegisterPage'
import { useAuthStore } from './ui/state/authStore'
import { DashboardPage } from './ui/pages/DashboardPage'

import { DatasetUploadPage } from './ui/pages/DatasetUploadPage'
import { ProjectsPage } from './ui/pages/ProjectsPage'
import { DataProfilingPage } from './ui/pages/DataProfilingPage'
import { SparkJobsPage } from './ui/pages/SparkJobsPage'
import { StreamingPage } from './ui/pages/StreamingPage'
import { MLModelsPage } from './ui/pages/MLModelsPage'
import { TrainingPage } from './ui/pages/TrainingPage'
import { PredictionsPage } from './ui/pages/PredictionsPage'
import { ModelRegistryPage } from './ui/pages/ModelRegistryPage'
import { AIAssistantPage } from './ui/pages/AIAssistantPage'
import { ReportsPage } from './ui/pages/ReportsPage'
import { MonitoringPage } from './ui/pages/MonitoringPage'
import { NotificationsPage } from './ui/pages/NotificationsPage'
import { SettingsPage } from './ui/pages/SettingsPage'
import { ProfilePage } from './ui/pages/ProfilePage'
import { AdminPanelPage } from './ui/pages/AdminPanelPage'
import { DataConnectorsPage } from './ui/pages/DataConnectorsPage'
import { WorkspacePage } from './ui/pages/WorkspacePage'

function ProtectedOutlet() {
  const token = useAuthStore((state) => state.accessToken)
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedOutlet />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dataset-upload" element={<DatasetUploadPage />} />
          <Route path="/connectors" element={<DataConnectorsPage />} />
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/data-profiling" element={<DataProfilingPage />} />
          <Route path="/spark-jobs" element={<SparkJobsPage />} />
          <Route path="/streaming" element={<StreamingPage />} />
          <Route path="/ml-models" element={<MLModelsPage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/predictions" element={<PredictionsPage />} />
          <Route path="/model-registry" element={<ModelRegistryPage />} />
          <Route path="/ai-assistant" element={<AIAssistantPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPanelPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
