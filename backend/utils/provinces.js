function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0111\u0110]/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const FALLBACK_PROVINCES = [
  { code: 4, name: "Cao Bằng" },
  { code: 20, name: "Lạng Sơn" },
  { code: 25, name: "Phú Thọ" },
  { code: 22, name: "Quảng Ninh" },
  { code: 19, name: "Thái Nguyên" },
  { code: 8, name: "Tuyên Quang" },
  { code: 15, name: "Lào Cai" },
  { code: 11, name: "Điện Biên" },
  { code: 12, name: "Lai Châu" },
  { code: 14, name: "Sơn La" },
  { code: 24, name: "Bắc Ninh" },
  { code: 33, name: "Hưng Yên" },
  { code: 37, name: "Ninh Bình" },
  { code: 1, name: "Hà Nội" },
  { code: 31, name: "Hải Phòng" },
  { code: 42, name: "Hà Tĩnh" },
  { code: 40, name: "Nghệ An" },
  { code: 44, name: "Quảng Trị" },
  { code: 38, name: "Thanh Hóa" },
  { code: 46, name: "Huế" },
  { code: 66, name: "Đắk Lắk" },
  { code: 52, name: "Gia Lai" },
  { code: 68, name: "Lâm Đồng" },
  { code: 56, name: "Khánh Hòa" },
  { code: 51, name: "Quảng Ngãi" },
  { code: 48, name: "Đà Nẵng" },
  { code: 75, name: "Đồng Nai" },
  { code: 80, name: "Tây Ninh" },
  { code: 79, name: "TP. Hồ Chí Minh" },
  { code: 91, name: "An Giang" },
  { code: 96, name: "Cà Mau" },
  { code: 82, name: "Đồng Tháp" },
  { code: 86, name: "Vĩnh Long" },
  { code: 92, name: "Cần Thơ" },
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

  return FALLBACK_PROVINCES.map((province) => ({
    code: province.code,
    name: province.name,
  }));
}

module.exports = {
  fetchProvinceList,
  FALLBACK_PROVINCES,
  normalizeText,
};
