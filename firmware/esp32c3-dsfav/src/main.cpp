#include <Arduino.h>

// Sensor and network adapters are intentionally stubs until the H1 hardware is selected.
namespace acquisition {
void begin_adxl355() {}
void begin_lis2dw12() {}
int read_fsr_raw() { return 0; }
void begin_websocket_from_provisioning() {}
}  // namespace acquisition

void setup() {
  Serial.begin(115200);
  acquisition::begin_adxl355();
  acquisition::begin_lis2dw12();
  acquisition::begin_websocket_from_provisioning();
}

void loop() { (void)acquisition::read_fsr_raw(); delay(100); }
