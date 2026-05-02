import { useEffect, useState } from "react";

function AIOBidApproval() {
  const [bids, setBids] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/aio-bids/")
      .then(res => res.json())
      .then(data => setBids(data));
  }, []);

  const handleApprove = async () => {
    await fetch("http://127.0.0.1:8000/api/approve-aio/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...form, id: selected }),
    });

    alert("Approved ✅");
    setSelected(null);
  };

  return (
    <div className="p-6">

      <h2 className="text-2xl font-bold mb-4">
        AIO Bid Approval
      </h2>

      {/* TABLE */}
      <div className="overflow-auto max-h-[500px] border">

        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-white sticky top-0">
            <tr>
              <th className="p-2">User</th>
              <th>Bid No</th>
              <th>Model No</th>
              <th>Qty</th>
              <th>End Date</th>
              <th>Status</th>
              <th>Remark</th>
              <th>Action</th>
              <th>Bid Qualify/Disqualify Reason</th>
               <th>Dealer Name</th>
               <th>Brand</th>
               <th>Price</th>
               

            </tr>
          </thead> 

          <tbody>
            {bids.map((b) => (
              <tr key={b.id} className="border-b">
                <td className="p-2">{b.user_name}</td>
                <td>{b.bid_no}</td>
                <td>{b.model}</td>
                <td>{b.qty}</td>
                <td>{b.date}</td>

                <td>
                  <span className={`px-2 py-1 rounded text-xs ${
                    b.status === "Approved"
                      ? "bg-green-100 text-green-600"
                      : "bg-yellow-100 text-yellow-600"
                  }`}>
                    {b.status}
                  </span>
                </td>

                <td>{b.remark}</td>

                <td>
                  <button
                    onClick={() => setSelected(b.id)}
                    className="bg-blue-500 text-white px-2 py-1 rounded"
                  >
                    {b.status === "Approved" ? "View" : "Approve"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center">

          <div className="bg-white p-6 rounded-xl w-[400px]">

            <h3 className="font-bold mb-3">Approve Bid</h3>

            <input
              placeholder="Processor Price"
              className="w-full border p-2 mb-2"
              onChange={(e) => setForm({ ...form, pro_price: e.target.value })}
            />

            <input
              placeholder="RAM Price"
              className="w-full border p-2 mb-2"
              onChange={(e) => setForm({ ...form, ram_price: e.target.value })}
            />

            <input
              placeholder="HDD Price"
              className="w-full border p-2 mb-2"
              onChange={(e) => setForm({ ...form, hdd_price: e.target.value })}
            />

            <input
              placeholder="Dealer Name"
              className="w-full border p-2 mb-2"
              onChange={(e) => setForm({ ...form, dealer_name: e.target.value })}
            />

            <input
              placeholder="Brand"
              className="w-full border p-2 mb-2"
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />

            <div className="flex gap-2 mt-3">
              <button
                onClick={handleApprove}
                className="bg-green-500 text-white px-4 py-2 rounded"
              >
                Submit
              </button>

              <button
                onClick={() => setSelected(null)}
                className="bg-gray-400 text-white px-4 py-2 rounded"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default AIOBidApproval;