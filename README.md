# Soát nháp tờ khai hải quan (IDA / EDA)
 
Trang web tĩnh để lập **bản nháp** tờ khai hải quan nhập khẩu (IDA) và xuất khẩu (EDA), soát lỗi và nhờ AI review trước khi khai chính thức trên ECUS5-VNACCS.
 
> **Lưu ý quan trọng**
> - Công cụ chỉ phục vụ rà soát nháp. Nó **không kết nối** hệ thống Hải quan và **không gửi** tờ khai; bạn vẫn phải nhập tay vào ECUS5.
> - Bảng mã (loại hình, phương thức vận chuyển, đơn vị tính…) được viết theo tham chiếu, **chưa phải bảng mã chính thức**. Luôn đối chiếu với danh mục trong ECUS5 (ví dụ đơn vị "cái, chiếc" đang là `PCE`, hãy xác nhận lại với ECUS5 của bạn).
> - Số thuế chỉ là **tạm tính để đối chiếu**, chưa gồm thuế tiêu thụ đặc biệt, bảo vệ môi trường, chống bán phá giá…
> - Kết quả AI (kể cả mã HS đề xuất) chỉ là **gợi ý**, có thể sai. AI không tra cứu được Biểu thuế hiện hành.
 
## Tính năng
 
- Hai chế độ: **Nhập khẩu (IDA)** và **Xuất khẩu (EDA)**, mỗi chế độ có bản nháp riêng.
- Form theo các phần: thông tin chung, người nhập/xuất khẩu, đại lý hải quan, vận đơn và vận chuyển, hóa đơn và thanh toán, hợp đồng và giấy phép, trị giá tính thuế (chỉ nhập khẩu), danh sách hàng, chứng từ đính kèm và ghi chú.
- **Tự tính**: tổng trị giá hóa đơn, phân bổ cước và bảo hiểm theo từng dòng hàng, thuế nhập khẩu / GTGT (hoặc thuế xuất khẩu) tạm tính.
- **Soát lỗi nội bộ**: trường bắt buộc, định dạng (mã số thuế 10 hoặc 13 số, mã HS 8 số, mã nước, mã đồng tiền, mã địa điểm), giới hạn 50 dòng hàng, cảnh báo điều kiện giá (FOB/EXW… thiếu cước), thiếu chứng từ, chữ có dấu (VNACCS chỉ nhận chữ không dấu, viết hoa; có nút bỏ dấu nhanh).
- **Tải chứng từ đính kèm**: kéo thả hoặc chọn file, tự đoán loại chứng từ theo tên file, lưu bền trong trình duyệt.
- **Dữ liệu review dạng `[key, value]`**, đọc trực tiếp từ các ô trên form.
- **AI review** qua Cloudflare Worker (Claude, GPT, Gemini) trả về CSV; cột `key` được gắn với **tiêu đề trường trên form** để người dùng dễ nhận biết mục cần chú ý.
- Với mã HS: AI kiểm tra mã so với mô tả hàng, đề xuất mã phù hợp hơn kèm lý do (GIR, chú giải), độ tin cậy.
- Bản xem trước tờ khai có dấu "BẢN NHÁP".

## Sơ đồ
 
Luồng nghiệp vụ:
 
![Luồng nghiệp vụ](/workflows/luong-nghiep-vu.png)
 
Luồng dữ liệu:
 
![Luồng dữ liệu](/workflows/luong-du-lieu.png)
