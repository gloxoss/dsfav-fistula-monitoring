#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <vector>

namespace dsfav {

constexpr std::size_t kHeaderSize = 18;

inline void write_le16(uint8_t* out, uint16_t value) {
  out[0] = static_cast<uint8_t>(value);
  out[1] = static_cast<uint8_t>(value >> 8);
}

inline void write_le32(uint8_t* out, uint32_t value) {
  for (unsigned i = 0; i < 4; ++i) out[i] = static_cast<uint8_t>(value >> (8 * i));
}

inline std::array<uint8_t, kHeaderSize> make_header(uint16_t version, uint16_t fs_adxl,
                                                   uint16_t fs_lis, uint32_t n_adxl,
                                                   uint32_t n_lis) {
  std::array<uint8_t, kHeaderSize> out{};
  out[0] = 'D'; out[1] = 'S'; out[2] = 'F'; out[3] = 'V';
  write_le16(out.data() + 4, version);
  write_le16(out.data() + 6, fs_adxl);
  write_le16(out.data() + 8, fs_lis);
  write_le32(out.data() + 10, n_adxl);
  write_le32(out.data() + 14, n_lis);
  return out;
}

inline void append_i16_le(std::vector<uint8_t>& out, int16_t value) {
  const auto bits = static_cast<uint16_t>(value);
  out.push_back(static_cast<uint8_t>(bits));
  out.push_back(static_cast<uint8_t>(bits >> 8));
}

inline std::vector<uint8_t> make_raw_payload(const int16_t* adxl, uint32_t n_adxl,
                                             const int16_t* lis, uint32_t n_lis,
                                             const int16_t* pressure, uint32_t n_pressure,
                                             uint16_t fs_adxl = 1000, uint16_t fs_lis = 200) {
  if (!adxl || !lis || !pressure || !fs_adxl || n_adxl % fs_adxl != 0 ||
      n_pressure != (n_adxl * 10u) / fs_adxl) return {};
  const auto header = make_header(1, fs_adxl, fs_lis, n_adxl, n_lis);
  std::vector<uint8_t> out(header.begin(), header.end());
  out.reserve(kHeaderSize + (static_cast<std::size_t>(n_adxl) + n_lis + n_pressure) * 6);
  for (uint32_t i = 0; i < n_adxl * 3; ++i) append_i16_le(out, adxl[i]);
  for (uint32_t i = 0; i < n_lis * 3; ++i) append_i16_le(out, lis[i]);
  for (uint32_t i = 0; i < n_pressure; ++i) append_i16_le(out, pressure[i]);
  return out;
}

template <typename T, std::size_t Capacity>
class OfflineRingBuffer {
 public:
  bool push(const T& item) {
    if (size_ == Capacity) return false;
    data_[(head_ + size_) % Capacity] = item;
    ++size_;
    return true;
  }
  const T* front() const { return size_ ? &data_[head_] : nullptr; }
  bool acknowledge_front() {
    if (!size_) return false;
    head_ = (head_ + 1) % Capacity;
    --size_;
    return true;
  }
  std::size_t size() const { return size_; }
  bool full() const { return size_ == Capacity; }

 private:
  std::array<T, Capacity> data_{};
  std::size_t head_ = 0;
  std::size_t size_ = 0;
};

}  // namespace dsfav
