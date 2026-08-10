import { useState } from "react";
import {
  Terminal,
  FolderLock,
  Key,
  Cpu,
  Shield,
  FileText,
  FileLock2,
  Settings,
} from "lucide-react";
import FolderList from "./components/FolderManager/FolderList";
import SecretGen from "./components/SecretGenerator/SecretGen";
import PasswordGen from "./components/PasswordGenerator/PasswordGen";
import VaultList from "./components/Vault/VaultList";
import SecureFiles from "./components/Vault/SecureFiles";
import ProjectForm from "./components/ProjectManager/ProjectForm";
import ProjectList from "./components/ProjectManager/ProjectList";
import Dashboard from "./components/UI/Dashboard";
import SettingsTab from "./components/UI/SettingsTab";

type Module =
  | "Dashboard"
  | "Projects"
  | "PasswordGen"
  | "SecretGen"
  | "Vault"
  | "SecureNotes"
  | "SecureFiles"
  | "Settings";

function App() {
  const [activeModule, setActiveModule] = useState<Module>("Dashboard");

  const navItems = [
    { id: "Dashboard", label: "Dashboard", icon: Terminal },
    { id: "Projects", label: "Projects", icon: FolderLock },
    { id: "PasswordGen", label: "Password Generator", icon: Key },
    { id: "SecretGen", label: "Secret Generator", icon: Cpu },
    { id: "Vault", label: "Vault", icon: Shield },
    { id: "SecureNotes", label: "Secure Notes", icon: FileText },
    { id: "SecureFiles", label: "Secure Files", icon: FileLock2 },
    { id: "Settings", label: "Settings", icon: Settings },
  ] as const;

  return (
    <div className="flex h-screen w-screen bg-cyber-black text-white overflow-hidden selection:bg-cyber-neonCyan selection:text-black">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-cyber-dark border-r border-cyber-panel flex flex-col relative">
        {/* Glowing edge line */}
        <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-cyber-neonCyan to-transparent opacity-20"></div>

        <div className="p-6">
          <h1 className="text-2xl font-heading font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyber-neonCyan to-cyber-neonPink animate-pulse-slow">
            VAULTFORGE
          </h1>
          <p className="text-xs text-cyber-neonCyan opacity-60 font-mono tracking-widest mt-1">
            v1.0.0 // LOCAL_SYS
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md transition-all duration-200 group relative overflow-hidden ${
                  isActive
                    ? "bg-cyber-panel text-cyber-neonCyan"
                    : "text-gray-400 hover:text-white hover:bg-cyber-panel/50"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyber-neonCyan shadow-neon-cyan"></div>
                )}
                <Icon
                  className={`w-5 h-5 ${isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}
                />
                <span className="font-heading tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative bg-cyber-black">
        {/* Subtle scanline overlay */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20 z-50"></div>

        <header className="h-16 border-b border-cyber-panel flex items-center px-8 z-10">
          <h2 className="text-xl font-heading text-cyber-neonCyan uppercase tracking-widest">
            {navItems.find((i) => i.id === activeModule)?.label}
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto p-8 z-10">
          {/* Module Routing */}
          {activeModule === "Dashboard" && <Dashboard />}
          {activeModule === "Projects" && <ProjectList />}
          {activeModule === "PasswordGen" && <PasswordGen />}
          {activeModule === "SecretGen" && <SecretGen />}
          {activeModule === "Vault" && <VaultList />}
          {activeModule === "SecureFiles" && <SecureFiles />}
          {activeModule === "Settings" && <SettingsTab />}
        </div>
      </main>
    </div>
  );
}

export default App;
