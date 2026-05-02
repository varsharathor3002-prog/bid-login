import { useParams } from "react-router-dom";
import { useState } from "react";

function PricePage() {
  const { type } = useParams();

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState("");

  // ✅ FULL options (matched with PHP)
  const options = {

    processor: [
      "Intel Core i3 12100",
      "Intel Core i5 12400",
      "Intel Core i5 12500",
      "Intel Core i5 13500",
      "Intel Core i5 14400",
      "Intel Core i5 14500",
      "Intel Core i7 12700",
      "Intel Core i7 13700",
      "Intel Core i9 12900",
      "Intel Core i9 13900",
      "Intel Core i9 14900",
      "AMD Ryzen 3 4300G",
      "AMD Ryzen 3 5300G",
      "AMD Ryzen 5 4600G",
      "AMD Ryzen 5 5600G",
      "AMD Ryzen 7 4700G",
      "AMD Ryzen 7 5700G",
      "AMD Ryzen 9 3900G",
      "12th Gen Composite i3",
      "12th Gen Composite i5",
      "12th Gen Composite i7",
    ],

    ram: [
      "8GB",
      "16GB",
      "32GB",
      "8GB DDR4 2666",
      "8GB DDR4 3200",
      "16GB DDR4 2666",
      "16GB DDR4 3200",
      "32GB DDR4 2666",
      "32GB DDR4 3200",
      "8GB DDDR 4800",
      "16GB DDDR 4800",
      "32GB DDDR 4800",
    ],

    hdd: [
      "1 TB",
      "2 TB",
      "None",
    ],

    ssd: [
      "128 GB",
      "256 GB",
      "512 GB",
      "1 TB",
      "128 GB SATA",
      "256 GB SATA",
      "512 GB SATA",
      "128 GB NVMe",
      "256 GB NVMe",
      "512 GB NVMe",
      "None",
    ],

    gp: [
      "2",
      "4",
      "6",
      "8",
      "None",
    ],

    os: [
      "Windows 10 Home",
      "Windows 10 Professional",
      "Windows 11 Home",
      "Windows 11 Professional",
      "DOS",
      "Linux",
    ],

    motherboard: [
      "Intel H610",
      "AMD B450",
      "AMD B550",
      "Intel B660",
      "Intel B760",
      "Intel Q670",
    ],

    dvd: [
      "Yes",
      "None",
    ],

    wifi: [
      "PCI Based 4.2 Bluetooth",
      "Wi-fi AC 4.2 Bluetooth",
      "Wi-Fi6 5.0 Bluetooth",
      "Wi-Fi AX201 5.2 Bluetooth",
    ],

    software1: [
      "MS Office",
    ],

    software2: [
      "Antivirus",
    ],

    monitor: [
      "18.5 inch",
      "19.5 inch",
      "21.5 inch",
      "23.8 inch",
      "27 inch",
    ],
  };

  // ✅ Submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    await fetch("http://127.0.0.1:8000/api/add-price/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type,
        name,
        price,
        date,
      }),
    });

    alert("Price Added ✅");

    setName("");
    setPrice("");
    setDate("");
  };

  return (
    <div className="p-6 flex justify-center">

      <div className="bg-white p-6 rounded shadow w-[380px]">

        {/* Title */}
        <h2 className="text-lg font-semibold mb-4 capitalize">
          {type} Price
        </h2>

        {/* Form */}
        <form onSubmit={handleSubmit}>

          {/* Select + Price */}
          <div className="mb-4">
            <label className="block text-sm mb-1">
              {type} {type === "monitor" ? "Size" : ""}
            </label>

            <div className="flex">

              {/* Dropdown */}
              <select
                className="w-[65%] p-2 border rounded-l"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              >
                <option value="">Select</option>
                {options[type]?.map((opt, i) => (
                  <option key={i} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              {/* Price */}
              <input
                type="number"
                placeholder="Enter"
                className="w-[35%] p-2 border border-l-0 rounded-r"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Date */}
          <div className="mb-4">
            <label className="block text-sm mb-1">Date</label>
            <input
              type="date"
              className="w-full p-2 border rounded"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Button */}
          <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">
            ADD Price
          </button>

        </form>
      </div>
    </div>
  );
}

export default PricePage;