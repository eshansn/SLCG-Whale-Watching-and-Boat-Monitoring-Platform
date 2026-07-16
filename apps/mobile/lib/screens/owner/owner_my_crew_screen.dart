import 'package:flutter/material.dart';

class OwnerMyCrewScreen extends StatelessWidget {
  const OwnerMyCrewScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text("My crew", style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 18)),
        centerTitle: true,
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
              children: [
                _buildCrewRow("Kasun M.", "Lifesaver"),
                const Divider(color: Colors.black12, height: 1),
                _buildCrewRow("Kasun M.", "Lifesaver"),
                const Divider(color: Colors.black12, height: 1),
                _buildCrewRow("Kasun M.", "Coxswain"),
                const Divider(color: Colors.black12, height: 1),
                _buildCrewRow("Kasun M.", "Diver"),
                const Divider(color: Colors.black12, height: 1),
              ],
            ),
          ),
          
          // Add New Member Card
          Padding(
            padding: const EdgeInsets.all(24.0),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: const Color(0xFF152238), // Dark Navy
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  const Text("Add New Member!", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
                  const SizedBox(height: 8),
                  const Text("Bring someone new on board!", style: TextStyle(color: Colors.white70, fontSize: 13)),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 44,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF152238),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () {},
                      child: const Text("Continue", style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  )
                ],
              ),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildCrewRow(String name, String role) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16.0),
      child: Row(
        children: [
          Expanded(flex: 2, child: Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.black87))),
          Expanded(flex: 3, child: Text(role, style: const TextStyle(fontSize: 14, color: Colors.black87))),
          const Icon(Icons.delete_outline, color: Colors.red, size: 20),
          const SizedBox(width: 16),
          const Icon(Icons.info_outline, color: Colors.black, size: 20),
        ],
      ),
    );
  }
}