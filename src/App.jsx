import React, { useState } from 'react'
import Calculator from './components/Calculator'
import Dashboard from './components/Dashboard'
import BottomNav from './components/BottomNav'

export default function App() {
  const [activeTab, setActiveTab] = useState('calculator')

  return (
    <div className="app">
      <div className="app__content">
        {activeTab === 'calculator' && <Calculator />}
        {activeTab === 'dashboard' && <Dashboard />}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
