import 'package:flutter/material.dart';
import '../../../widgets/owner_layout.dart';

class OwnerNewTripScreen extends StatefulWidget {
  const OwnerNewTripScreen({super.key});

  @override
  State<OwnerNewTripScreen> createState() => _OwnerNewTripScreenState();
}

class _OwnerNewTripScreenState extends State<OwnerNewTripScreen> {
  // State for checkboxes to make them interactive
  List<bool> crewChecks = [true, false, true, true];

  @override
  Widget build(BuildContext context) {
    return OwnerLayout(
      child: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("Select A Vessel", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87)),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade200), borderRadius: BorderRadius.circular(12)),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        isExpanded: true,
                        value: "Mirissa King",
                        icon: const Icon(Icons.keyboard_arrow_down, color: Colors.black87),
                        items: ["Mirissa King", "Sea Princess"].map((String value) {
                          return DropdownMenuItem<String>(value: value, child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500)));
                        }).toList(),
                        onChanged: (_) {},
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  
                  const Text("Select Date & Time", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87)),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                    decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade200), borderRadius: BorderRadius.circular(12)),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text("06:30:00 Sat, June 23", style: TextStyle(color: Colors.grey.shade600)),
                        const Icon(Icons.calendar_today_outlined, color: Colors.black87, size: 20),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  const Text("Select Crew", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87)),
                  const SizedBox(height: 12),
                  
                  _buildCrewRow(0, "Kasun M.", "Lifesaver"),
                  const Divider(height: 1, color: Colors.black12),
                  _buildCrewRow(1, "Kasun M.", "Lifesaver"),
                  const Divider(height: 1, color: Colors.black12),
                  _buildCrewRow(2, "Kasun M.", "Coxswain"),
                  const Divider(height: 1, color: Colors.black12),
                  _buildCrewRow(3, "Kasun M.", "Diver"),
                  const Divider(height: 1, color: Colors.black12),
                ],
              ),
            ),
          ),
          
          // Fixed Bottom Button
          Padding(
            padding: const EdgeInsets.all(24.0),
            child: SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F172A),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () => Navigator.pop(context),
                child: const Text("Schedule Trip", style: TextStyle(fontSize: 16)),
              ),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildCrewRow(int index, String name, String role) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        children: [
          Expanded(flex: 2, child: Text(name, style: const TextStyle(fontSize: 13, color: Colors.black87))),
          Expanded(flex: 3, child: Text(role, style: const TextStyle(fontSize: 13, color: Colors.black87))),
          Checkbox(
            value: crewChecks[index],
            activeColor: const Color(0xFF152238),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
            onChanged: (bool? value) {
              setState(() {
                crewChecks[index] = value ?? false;
              });
            },
          )
        ],
      ),
    );
  }
}