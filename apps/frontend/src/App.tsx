import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// 占位页面组件
const LoginPage = () => <div>登录页面 - 待实现</div>;
const DashboardPage = () => <div>仪表盘 - 待实现</div>;
const TenantListPage = () => <div>租户管理 - 待实现</div>;
const UserListPage = () => <div>用户管理 - 待实现</div>;
const KnowledgeBasePage = () => <div>知识库管理 - Phase 2 实现</div>;
const ConversationPage = () => <div>对话管理 - Phase 3 实现</div>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tenants" element={<TenantListPage />} />
        <Route path="/users" element={<UserListPage />} />
        <Route path="/knowledge" element={<KnowledgeBasePage />} />
        <Route path="/conversations" element={<ConversationPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
