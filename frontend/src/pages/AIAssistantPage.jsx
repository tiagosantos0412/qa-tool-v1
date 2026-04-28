// src/pages/AIAssistantPage.jsx
import { useEffect }   from 'react';
import { useParams }   from 'react-router-dom';
import { useProject }  from '../context/contexts';
import AIAssistantPanel from '../components/AI/AIAssistantPanel';

export default function AIAssistantPage() {
  const { projectId }   = useParams();
  const { loadProject, currentProject } = useProject();

  useEffect(() => { if (projectId) loadProject(projectId); }, [projectId]);

  return (
    <div className="animate-fade-in" style={{ height:'calc(100vh - var(--topbar-h) - 56px)', display:'flex', flexDirection:'column' }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ marginBottom:4 }}>Assistente IA</h1>
        <p style={{ color:'var(--text-secondary)', fontSize:'0.85rem' }}>
          {currentProject ? currentProject.name : 'Selecione um projeto na sidebar'} · Powered by Claude
        </p>
      </div>
      <div style={{ flex:1, minHeight:0 }}>
        <AIAssistantPanel />
      </div>
    </div>
  );
}
