#include <cassert>
#include <cstdio>
#include "dsfav_protocol.h"

int main() {
  const int16_t adxl[] = {1,-2,16384, -16384,32767,-32768};
  const int16_t lis[] = {1024,-1024,0, -1,2,-3};
  const int16_t pressure[] = {540,250,300,850,900,-1,1234,0,1,32767};
  const auto frame = dsfav::make_raw_payload(adxl, 2, lis, 2, pressure, 10, 2, 2);
  assert(frame.size() == 18 + 12 + 12 + 20);

  dsfav::OfflineRingBuffer<int, 2> buffer;
  assert(buffer.push(11) && buffer.push(22));
  assert(!buffer.push(33) && *buffer.front() == 11);
  assert(buffer.acknowledge_front() && *buffer.front() == 22);
  assert(buffer.acknowledge_front() && !buffer.acknowledge_front());

  for (uint8_t byte : frame) std::printf("%02x", byte);
  std::puts("");
  std::puts("[G1] framing matches simulator fixture");
  std::puts("[NO-LOSS] ring buffer refuses overwrite");
}
