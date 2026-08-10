import { Settings, Shield, Monitor } from "lucide-react";

export default function SettingsTab() {
  return (
    <div className="max-w-3xl space-y-8 p-4">
      <h2 className="text-2xl font-heading text-white flex items-center">
        <Settings className="mr-3" /> Application Settings
      </h2>

      <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg space-y-6">
        <div>
          <h3 className="text-lg text-white mb-4 flex items-center">
            <Monitor className="mr-2 w-5" /> General
          </h3>
          <div className="grid grid-cols-2 items-center">
            <span className="text-gray-400 text-sm">Default IDE</span>
            <select className="bg-black border border-gray-700 text-white p-2 text-sm w-full">
              <option>VS Code</option>
              <option>Cursor</option>
              <option>System Default</option>
            </select>
          </div>
        </div>

        <hr className="border-gray-800" />

        <div>
          <h3 className="text-lg text-white mb-4 flex items-center">
            <Shield className="mr-2 w-5" /> Security
          </h3>
          <div className="grid grid-cols-2 items-center mb-4">
            <span className="text-gray-400 text-sm">Auto-Lock Vault</span>
            <select className="bg-black border border-gray-700 text-white p-2 text-sm w-full">
              <option>After 5 minutes of inactivity</option>
              <option>After 15 minutes of inactivity</option>
              <option>Never (Manual Lock Only)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 items-center">
            <span className="text-gray-400 text-sm">
              Clear Clipboard on Exit
            </span>
            <input
              type="checkbox"
              className="w-5 h-5 bg-black border-gray-700 rounded"
              defaultChecked
            />
          </div>
        </div>
      </div>
    </div>
  );
}
