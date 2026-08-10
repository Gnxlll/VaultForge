import { useState } from "react";
import { Key, Copy, RefreshCw, CheckCircle2, Shield } from "lucide-react";
import { safeInvoke } from "../../utils/tauri";

type Mode = "STANDARD" | "PASSPHRASE";

export default function PasswordGen() {
  const [mode, setMode] = useState<Mode>("STANDARD");
  const [password, setPassword] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Standard State
  const [length, setLength] = useState<number | "custom">(24);
  const [customLength, setCustomLength] = useState(24);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);

  // Passphrase State
  const [wordCount, setWordCount] = useState(4);
  const [separator, setSeparator] = useState("-");
  const [capitalize, setCapitalize] = useState(true);
  const [includeNumber, setIncludeNumber] = useState(true);

  const generate = async () => {
    try {
      setError(null);

      let generated = "";

      if (mode === "STANDARD") {
        generated = await safeInvoke<string>("generate_password", {
          length,
          useUpper,
          useLower,
          useNumbers,
          useSymbols,
        });
      } else {
        generated = await safeInvoke<string>("generate_passphrase", {
          wordCount,
          separator,
          capitalize,
          includeNumber,
        });
      }

      setPassword(generated);
      setCopied(false);
    } catch (err) {
      setError(String(err));
      setPassword("");
    }
  };

  // Generation happens only when the user clicks the Generate button.

  const handleCopy = async () => {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Prevent user from unchecking all standard options
  const handleToggle = (
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    currentValue: boolean,
  ) => {
    const activeCount = [useUpper, useLower, useNumbers, useSymbols].filter(
      Boolean,
    ).length;
    if (activeCount === 1 && currentValue) return; // Don't uncheck the last active option
    setter(!currentValue);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="border-b border-cyber-panel pb-4">
        <div className="flex items-center space-x-3">
          <Key className="text-cyber-neonCyan w-6 h-6" />
          <h3 className="text-2xl font-heading text-white">
            CREDENTIAL GENERATOR
          </h3>
        </div>
        <p className="text-cyber-neonCyan opacity-70 font-mono text-sm mt-2">
          Generate secure, random credentials for human use.
        </p>
      </div>

      {/* Mode Selector */}
      <div className="flex space-x-4 border-b border-gray-800 pb-4">
        <button
          onClick={() => setMode("STANDARD")}
          className={`px-6 py-2 font-heading tracking-wider uppercase transition-all ${mode === "STANDARD" ? "bg-cyber-panel text-cyber-neonCyan border border-cyber-neonCyan shadow-neon-cyan" : "text-gray-500 hover:text-white"}`}
        >
          Standard Password
        </button>
        <button
          onClick={() => setMode("PASSPHRASE")}
          className={`px-6 py-2 font-heading tracking-wider uppercase transition-all ${mode === "PASSPHRASE" ? "bg-cyber-panel text-cyber-neonPink border border-cyber-neonPink shadow-[0_0_10px_rgba(255,0,255,0.3)]" : "text-gray-500 hover:text-white"}`}
        >
          Passphrase Mode
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Controls Panel */}
        <div className="bg-cyber-panel border border-cyber-dim p-6 space-y-6">
          {mode === "STANDARD" ? (
            <>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-mono text-gray-400 uppercase">
                    Password Length
                  </label>
                  <span className="text-xs font-mono text-cyber-neonCyan">
                    {length === "custom" ? customLength : `${length} chars`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[12, 16, 20, 24, 32].map((len) => (
                    <button
                      key={len}
                      onClick={() => {
                        setLength(len);
                        setCustomLength(len);
                      }}
                      className={`px-4 py-2 border ${length === len ? "bg-blue-900/40 border-blue-500 text-white" : "border-gray-700 text-gray-400"}`}
                    >
                      {len}
                    </button>
                  ))}
                  <button
                    onClick={() => setLength("custom")}
                    className={`px-4 py-2 border ${length === "custom" ? "bg-blue-900/40 border-blue-500 text-white" : "border-gray-700 text-gray-400"}`}
                  >
                    Custom
                  </button>
                  {length === "custom" && (
                    <input
                      type="number"
                      min={8}
                      max={256}
                      value={customLength}
                      onChange={(e) => setCustomLength(Number(e.target.value))}
                      className="ml-2 w-24 p-1 bg-black border border-gray-700 text-white text-sm"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={useUpper}
                    onChange={() => handleToggle(setUseUpper, useUpper)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-mono text-gray-300">
                    Uppercase (A-Z)
                  </span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={useLower}
                    onChange={() => handleToggle(setUseLower, useLower)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-mono text-gray-300">
                    Lowercase (a-z)
                  </span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={useNumbers}
                    onChange={() => handleToggle(setUseNumbers, useNumbers)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-mono text-gray-300">
                    Numbers (0-9)
                  </span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={useSymbols}
                    onChange={() => handleToggle(setUseSymbols, useSymbols)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-mono text-gray-300">
                    Symbols (!@#)
                  </span>
                </label>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-mono text-gray-400 uppercase">
                    Word Count
                  </label>
                  <span className="text-xs font-mono text-cyber-neonPink">
                    {wordCount} words
                  </span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="12"
                  step="1"
                  value={wordCount}
                  onChange={(e) => setWordCount(Number(e.target.value))}
                  className="w-full accent-cyber-neonPink"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono text-gray-400 uppercase">
                  Separator
                </label>
                <select
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value)}
                  className="w-full bg-cyber-dark border border-gray-700 text-white p-2.5 font-mono text-sm focus:border-cyber-neonPink outline-none"
                >
                  <option value="-">Hyphen (-)</option>
                  <option value="_">Underscore (_)</option>
                  <option value=".">Period (.)</option>
                  <option value=" ">Space</option>
                  <option value="">None</option>
                </select>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <div
                    className={`w-4 h-4 border ${capitalize ? "bg-cyber-neonPink border-cyber-neonPink" : "border-gray-600 group-hover:border-cyber-neonPink"}`}
                  ></div>
                  <span className="text-sm font-mono text-gray-300">
                    Capitalize Words
                  </span>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={capitalize}
                    onChange={() => setCapitalize(!capitalize)}
                  />
                </label>
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <div
                    className={`w-4 h-4 border ${includeNumber ? "bg-cyber-neonPink border-cyber-neonPink" : "border-gray-600 group-hover:border-cyber-neonPink"}`}
                  ></div>
                  <span className="text-sm font-mono text-gray-300">
                    Include a Number
                  </span>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={includeNumber}
                    onChange={() => setIncludeNumber(!includeNumber)}
                  />
                </label>
              </div>
            </>
          )}

          <button
            onClick={async () => {
              // ensure length numeric when custom
              let useLen = 24;
              if (length === "custom") useLen = customLength;
              else useLen = Number(length);
              // apply length to state used by generator
              // temporarily set numeric length variable and call generate
              // The generator uses `length` from closure; so set length state accordingly
              if (length === "custom") {
                // set a numeric length for the call
                // we temporarily set a numeric value and restore 'custom' after generate
                setLength(useLen);
                await generate();
                setLength("custom");
              } else {
                await generate();
              }
            }}
            className={`w-full flex items-center justify-center space-x-2 bg-cyber-dark border p-3 transition-all ${mode === "STANDARD" ? "border-cyber-neonCyan text-cyber-neonCyan hover:bg-cyber-neonCyan hover:text-black hover:shadow-neon-cyan" : "border-cyber-neonPink text-cyber-neonPink hover:bg-cyber-neonPink hover:text-black shadow-[0_0_10px_rgba(255,0,255,0.1)] hover:shadow-[0_0_15px_rgba(255,0,255,0.4)]"}`}
          >
            <RefreshCw size={16} />
            <span className="font-heading uppercase font-bold tracking-wider">
              GENERATE PASSWORD
            </span>
          </button>
        </div>

        {/* Output Panel */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-cyber-dark border border-gray-800 p-6 relative overflow-hidden">
            <div
              className={`absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent ${mode === "STANDARD" ? "via-cyber-neonCyan" : "via-cyber-neonPink"} to-transparent opacity-30`}
            ></div>

            <label className="text-xs font-mono text-gray-500 uppercase mb-4 block">
              Generated Output
            </label>

            {error ? (
              <div className="text-red-500 font-mono text-sm break-all">
                {error}
              </div>
            ) : (
              <div className="font-mono text-2xl text-white break-all leading-relaxed selection:bg-gray-800 selection:text-white flex items-center justify-center min-h-[100px] text-center">
                {password || "Generating..."}
              </div>
            )}

            {/* Action Overlay */}
            <div className="mt-8 flex justify-end space-x-3">
              <button
                onClick={handleCopy}
                disabled={!password}
                className={`flex items-center space-x-2 px-4 py-2 bg-cyber-panel border transition-colors disabled:opacity-50 ${copied ? "border-cyber-neonGreen text-cyber-neonGreen" : "border-gray-700 hover:border-gray-400"}`}
              >
                {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                <span className="font-heading uppercase font-bold tracking-wide text-sm">
                  {copied ? "Copied" : "Copy"}
                </span>
              </button>

              <button
                disabled={!password}
                className="flex items-center space-x-2 px-4 py-2 bg-cyber-neonGreen/10 border border-cyber-neonGreen text-cyber-neonGreen hover:bg-cyber-neonGreen hover:text-black transition-colors disabled:opacity-50"
              >
                <Shield size={16} />
                <span className="font-heading uppercase font-bold tracking-wide text-sm">
                  Save to Vault
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
