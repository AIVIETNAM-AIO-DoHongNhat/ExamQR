/** Nhận diện đơn vị, cấu hình qua biến môi trường NEXT_PUBLIC_ORG_* (đọc được ở cả server và trình duyệt). */
export const brand = {
  appName: "ExamQR",
  orgName: process.env.NEXT_PUBLIC_ORG_NAME?.trim() || "",
  orgUnit: process.env.NEXT_PUBLIC_ORG_UNIT?.trim() || "",
  logo: process.env.NEXT_PUBLIC_ORG_LOGO?.trim() || "",
};

/** Dòng phụ dưới tên ứng dụng: "Khoa … · Học viện …" hoặc mô tả chung. */
export const brandLine = [brand.orgUnit, brand.orgName].filter(Boolean).join(" · ") || "Kiểm tra trắc nghiệm trên lớp";
