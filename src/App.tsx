import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import WalkSession from './pages/WalkSession'
import Community from './pages/Community'
import CommunityDetail from './pages/CommunityDetail'
import Challenges from './pages/Challenges'
import Profile from './pages/Profile'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="walk" element={<WalkSession />} />
          <Route path="community" element={<Community />} />
          <Route path="community/:postId" element={<CommunityDetail />} />
          <Route path="challenges" element={<Challenges />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App










