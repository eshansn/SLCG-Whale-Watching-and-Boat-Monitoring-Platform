import 'package:flutter/material.dart';
import '../../widgets/owner_layout.dart';

class OwnerTripInfoScreen extends StatefulWidget {
  const OwnerTripInfoScreen({Key? key}) : super(key: key);

  @override
  State<OwnerTripInfoScreen> createState() => _OwnerTripInfoScreenState();
}

class _OwnerTripInfoScreenState extends State<OwnerTripInfoScreen> {
  String _sortValue = 'Name';

  @override
  Widget build(BuildContext context) {
    return OwnerLayout(
      // We wrap the entire body in a Container with Colors.white to override any inherited dark themes or gradients
      child: Container(
        color: Colors.white,
        width: double.infinity,
        height: double.infinity,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 32.0, vertical: 24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              
              // --- 1. Top Section: Boat Info & QR Code ---
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Left Column: Text Data
                  Expanded(
                    flex: 1,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text("Boat", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.black)),
                        const SizedBox(height: 4),
                        const Text("Mirissa King", style: TextStyle(fontSize: 18, color: Colors.black87, fontWeight: FontWeight.w400)),
                        const SizedBox(height: 20),
                        
                        const Text("Time", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.black)),
                        const SizedBox(height: 4),
                        const Text("06:30 AM", style: TextStyle(fontSize: 18, color: Colors.black87, fontWeight: FontWeight.w400)),
                        const SizedBox(height: 20),
                        
                        const Text("Date", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.black)),
                        const SizedBox(height: 4),
                        const Text("Tue, 23 June", style: TextStyle(fontSize: 18, color: Colors.black87, fontWeight: FontWeight.w400)),
                        const SizedBox(height: 12),
                        
                        Row(
                          children: [
                            Container(
                              width: 8, 
                              height: 8, 
                              decoration: const BoxDecoration(color: Color(0xFF39FF14), shape: BoxShape.circle)
                            ),
                            const SizedBox(width: 8),
                            const Text(
                              "APPROVED", 
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF32CD32), letterSpacing: 1.0)
                            ),
                          ],
                        )
                      ],
                    ),
                  ),
                  
                  // Right Column: Huge QR Code
                  Expanded(
                    flex: 1,
                    child: Align(
                      alignment: Alignment.topRight,
                      child: Image.asset(
                        'assets/images/qr_image.png',
                        fit: BoxFit.contain,
                        // Ensures the QR code is large and crisp
                        height: 280, 
                        errorBuilder: (context, error, stackTrace) => Container(
                          height: 280,
                          width: 280,
                          color: Colors.grey.shade100,
                          child: const Center(child: Text("qr_image.png missing")),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              
              const SizedBox(height: 48),

              // --- 2. Passenger Info Section ---
              const Text("Passenger Info", style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.black)),
              const SizedBox(height: 16),
              
              // Search and Filter Bar
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      style: const TextStyle(color: Colors.black),
                      decoration: const InputDecoration(
                        hintText: "Search",
                        hintStyle: TextStyle(color: Colors.grey, fontSize: 14),
                        prefixIcon: Icon(Icons.search, color: Colors.grey, size: 20),
                        suffixIcon: Icon(Icons.mic_none, color: Colors.grey, size: 20),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(8)
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _sortValue,
                        icon: const Icon(Icons.keyboard_arrow_down, size: 16, color: Colors.black87),
                        style: const TextStyle(fontSize: 12, color: Colors.black87, fontWeight: FontWeight.w600),
                        items: ['Name', 'Age', 'Nationality'].map((String value) {
                          return DropdownMenuItem<String>(
                            value: value,
                            child: Text("Sort by : $value"),
                          );
                        }).toList(),
                        onChanged: (newValue) {
                          setState(() {
                            _sortValue = newValue!;
                          });
                        },
                      ),
                    ),
                  )
                ],
              ),
              
              const SizedBox(height: 16),
              
              // Passenger Data Table
              SizedBox(
                width: double.infinity,
                child: Theme(
                  // Override divider theme to match minimal design
                  data: Theme.of(context).copyWith(
                    dividerColor: Colors.grey.shade200,
                  ),
                  child: DataTable(
                    headingTextStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black87),
                    dataTextStyle: const TextStyle(fontSize: 12, color: Colors.black87, fontWeight: FontWeight.w500),
                    horizontalMargin: 16,
                    columnSpacing: 40,
                    dividerThickness: 0.5,
                    columns: const [
                      DataColumn(label: Text("Name")),
                      DataColumn(label: Text("NIC or PassPort")),
                      DataColumn(label: Text("Age")),
                      DataColumn(label: Text("Nationality")),
                    ],
                    rows: [
                      _buildPassengerRow("Rathnayake M.", "20032131313", "Adult", "Local"),
                      _buildPassengerRow("Rathnayake M.", "20032131313", "Adult", "Local"),
                      _buildPassengerRow("Rathnayake M.", "20032131313", "Adult", "Local"),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 32),

              // --- 3. No Emergencies Button ---
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF39FF14), // Bright neon green matching design
                    foregroundColor: Colors.black,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    elevation: 0,
                  ),
                  onPressed: () {
                    // Emergency action
                  },
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text("No Emergencies", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      SizedBox(width: 12),
                      Icon(Icons.notifications_none, size: 20, color: Colors.black),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // --- 4. Live Map Image ---
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.asset(
                  'assets/images/map_image.png',
                  width: double.infinity,
                  height: 300,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => Container(
                    height: 300,
                    width: double.infinity,
                    color: Colors.blue.shade100,
                    child: const Center(
                      child: Text("map_image.png missing\n(Check pubspec.yaml)", textAlign: TextAlign.center, style: TextStyle(color: Colors.black54)),
                    ),
                  ),
                ),
              ),
              
              const SizedBox(height: 40), // Bottom padding buffer
            ],
          ),
        ),
      ),
    );
  }

  // Helper function to keep code clean
  DataRow _buildPassengerRow(String name, String id, String age, String nationality) {
    return DataRow(
      cells: [
        DataCell(Text(name)),
        DataCell(Text(id)),
        DataCell(Text(age)),
        DataCell(Text(nationality)),
      ],
    );
  }
}