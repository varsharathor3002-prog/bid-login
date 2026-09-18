import { useNavigate } from "react-router-dom";
import { FaFileSignature, FaClipboardCheck, FaArrowRight } from "react-icons/fa";

export default function BidTypeSelect() {
  const navigate = useNavigate();

  const options = [
    {
      key: "pre-bid",
      title: "Pre Bid",
      description: "Create, review and manage bids before submission.",
      icon: FaFileSignature,
      path: "/login/pre-bid",
    },
    {
      key: "post-bid",
      title: "Post Bid",
      description: "Access post-bid records and documentation.",
      icon: FaClipboardCheck,
      path: "/login/post-bid",
    },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-b from-gray-200 via-gray-300 to-gray-400">
      <header
        style={{
          background: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 3rem",
          flexShrink: 0,
          boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
          height: "100px",
        }}
      >
        <img src="/logo2.png" alt="Logo 2" className="h-[250px] w-auto object-contain" />
        <img src="/logo1.png" alt="Logo 1" className="h-[300px] w-auto object-contain" />
      </header>

      <div className="flex-1 min-h-0 flex flex-col items-center justify-start overflow-hidden px-6 pt-4 sm:pt-6 pb-8">
        <span className="uppercase tracking-[0.3em] text-xs font-semibold text-red-600 mb-3">
          Get Started
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2 text-center">
          Choose Your Bid Workflow
        </h1>
        <p className="text-sm sm:text-base text-gray-500 mb-12 text-center max-w-md">
          Select an option below to continue to the right login for your workflow.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 w-full max-w-2xl">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => navigate(opt.path)}
                className="group relative flex flex-col items-start text-left rounded-2xl bg-white border border-gray-200 px-7 py-8 cursor-pointer transition-all duration-300 hover:border-red-200 hover:-translate-y-1.5 hover:shadow-2xl shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 text-2xl text-white shadow-lg ring-4 ring-red-500/10 bg-gradient-to-br from-red-500 to-red-700 transition-transform duration-300 group-hover:scale-110">
                  <Icon />
                </div>

                <h2 className="text-xl font-bold text-gray-800 mb-1.5">{opt.title}</h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-6">{opt.description}</p>

                <span className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 transition-all duration-300 group-hover:gap-3">
                  Continue <FaArrowRight className="text-xs" />
                </span>

                <div className="absolute inset-x-0 bottom-0 h-1 rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-red-500 to-red-700" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
