import { FolderOpen, KeyRound, Lock, FileText } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="space-y-8 p-6">
      <h1 className="text-3xl font-heading text-white">
        Welcome to VaultForge
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg hover:border-blue-500 cursor-pointer transition-colors">
          <FolderOpen className="text-blue-500 w-8 h-8 mb-4" />
          <h3 className="text-white font-bold">Manage Projects</h3>
          <p className="text-sm text-gray-400 mt-2">
            Open or configure workspaces
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg hover:border-green-500 cursor-pointer transition-colors">
          <KeyRound className="text-green-500 w-8 h-8 mb-4" />
          <h3 className="text-white font-bold">Generate Password</h3>
          <p className="text-sm text-gray-400 mt-2">
            Create secure credentials
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg hover:border-purple-500 cursor-pointer transition-colors">
          <Lock className="text-purple-500 w-8 h-8 mb-4" />
          <h3 className="text-white font-bold">Access Vault</h3>
          <p className="text-sm text-gray-400 mt-2">
            View encrypted credentials
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg hover:border-yellow-500 cursor-pointer transition-colors">
          <FileText className="text-yellow-500 w-8 h-8 mb-4" />
          <h3 className="text-white font-bold">Secure Notes</h3>
          <p className="text-sm text-gray-400 mt-2">Write encrypted text</p>
        </div>
      </div>
    </div>
  );
}
