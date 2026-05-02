import { useEffect, useState } from "react";

function DesktopBidApproval() {
  const [bids, setBids] = useState([]);
  const [form, setForm] = useState({});
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/approved-bids/")
      .then(res => res.json())
      .then(data => setBids(data));
  }, []);

  const handleUpdate = async () => {
    await fetch("http://127.0.0.1:8000/api/update-bid/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...form, id: selectedId }),
    });

    alert("Updated ✅");
    setSelectedId(null);
  };

  return (
    <div className="p-6">

      <h2 className="text-xl font-bold mb-4">
        Desktop Approved Bids
      </h2>

      <table className="w-full border text-sm">
        <thead className="bg-gray-800 text-white">
          <tr>
            <th className="p-2">S.No</th>
            <th>Bid No</th>
            <th>Model</th>
            <th>Remark</th>
            <th>Date</th>
            <th>Status</th>
            <th>Action</th>
            <th>Remark</th>
            <th>Bid Qualify/ Disqualify Reason</th>
            <th>Dealer Name</th>
            <th>Brand</th>
             <th>Price</th>
            

            
          </tr>
        </thead>

        <tbody>
          {bids.map((b, i) => (
            <tr key={b.id} className="border-b">
              <td className="p-2">{i + 1}</td>
              <td>{b.bid_no}</td>
              <td>{b.model}</td>
              <td>{b.remark}</td>
              <td>{b.date}</td>
              <td className="text-green-600">{b.status}</td>
              <td>
                <button
                  onClick={() => setSelectedId(b.id)}
                  className="bg-blue-500 text-white px-2 py-1 rounded"
                >
                  L1 Update
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal */}
      {selectedId && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center">

          <div className="bg-white p-6 rounded-xl w-[350px]">

            <h3 className="font-bold mb-3">Update Bid</h3>

            <select
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full border p-2 mb-2"
            >
              <option value="">Select Status</option>
              <option>Qualified</option>
              <option>Disqualified</option>
            </select>

            <input
              placeholder="Reason"
              className="w-full border p-2 mb-2"
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />

            <input
              placeholder="Dealer Name"
              className="w-full border p-2 mb-2"
              onChange={(e) => setForm({ ...form, dname: e.target.value })}
            />

            <input
              type="number"
              placeholder="Price"
              className="w-full border p-2 mb-2"
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />

            <input
              placeholder="Brand"
              className="w-full border p-2 mb-2"
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />

            <div className="flex gap-2 mt-3">
              <button
                onClick={handleUpdate}
                className="bg-green-500 text-white px-4 py-2 rounded"
              >
                Submit
              </button>

              <button
                onClick={() => setSelectedId(null)}
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

export default DesktopBidApproval;