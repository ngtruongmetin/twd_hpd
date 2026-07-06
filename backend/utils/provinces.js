const FALLBACK_PROVINCES = [
  { name: "Cao Bằng" },
  { name: "Lạng Sơn" },
  { name: "Phú Thọ" },
  { name: "Quảng Ninh" },
  { name: "Thái Nguyên" },
  { name: "Tuyên Quang" },
  { name: "Lào Cai" },
  { name: "Điện Biên" },
  { name: "Lai Châu" },
  { name: "Sơn La" },
  { name: "Bắc Ninh" },
  { name: "Hưng Yên" },
  { name: "Ninh Bình" },
  { name: "Hà Nội" },
  { name: "Hải Phòng" },
  { name: "Hà Tĩnh" },
  { name: "Nghệ An" },
  { name: "Quảng Trị" },
  { name: "Thanh Hóa" },
  { name: "Huế" },
  { name: "Đắk Lắk" },
  { name: "Gia Lai" },
  { name: "Lâm Đồng" },
  { name: "Khánh Hòa" },
  { name: "Quảng Ngãi" },
  { name: "Đà Nẵng" },
  { name: "Đồng Nai" },
  { name: "Tây Ninh" },
  { name: "TP. Hồ Chí Minh" },
  { name: "An Giang" },
  { name: "Cà Mau" },
  { name: "Đồng Tháp" },
  { name: "Vĩnh Long" },
  { name: "Cần Thơ" },
];

async function fetchProvinceList() {
  try {
    const response = await fetch("https://provinces.open-api.vn/api/v2/p/");
    if (!response.ok) {
      throw new Error("Failed to fetch provinces");
    }

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data.map((item) => ({
        code: item.code,
        name: item.name,
      }));
    }
  } catch {
    // Ignore and fall back to the bundled list below.
  }

  return FALLBACK_PROVINCES.map((province, index) => ({
    code: index + 1,
    name: province.name,
  }));
}

module.exports = {
  fetchProvinceList,
  FALLBACK_PROVINCES,
};
