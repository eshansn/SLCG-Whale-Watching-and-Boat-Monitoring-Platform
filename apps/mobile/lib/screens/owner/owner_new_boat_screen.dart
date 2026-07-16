import 'package:flutter/material.dart';

class OwnerNewBoatScreen extends StatelessWidget {
  const OwnerNewBoatScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black),
        title: const Text("New Boat", style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 18)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("Photograph of the Boat", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87)),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              height: 160,
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [Colors.blue.shade100, Colors.blue.shade50], begin: Alignment.topCenter, end: Alignment.bottomCenter),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Center(child: Icon(Icons.attach_file, size: 64, color: Colors.white)),
            ),
            const SizedBox(height: 24),
            
            _buildLabel("Name"),
            _buildTextField("Mirissa king"),
            
            Row(
              children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_buildLabel("Registration No."), _buildTextField("SL-WB-0016")])),
                const SizedBox(width: 16),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_buildLabel("Registration Date"), _buildTextField("10 June 2026", icon: Icons.calendar_today_outlined)])),
              ],
            ),
            
            Row(
              children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_buildLabel("Maximum Capacity"), _buildTextField("150")])),
                const SizedBox(width: 16),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_buildLabel("Boat length"), _buildTextField("25.7 m")])),
              ],
            ),

            Row(
              children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_buildLabel("Hull Number"), _buildTextField("156466")])),
                const SizedBox(width: 16),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_buildLabel("Boat Width"), _buildTextField("5.7 m")])),
              ],
            ),

            const SizedBox(height: 24),
            const Text("Hull Number", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87)), // Assuming "Hull Number" here is a typo in mockup for "Documents", keeping for fidelity
            const SizedBox(height: 12),
            
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(12)),
              child: Column(
                children: [
                  _buildDocumentSlot("Certificate of registration of\nSole Propertiship", uploaded: true, filename: "Mirissaking.pdf"),
                  const SizedBox(height: 12),
                  _buildDocumentSlot("ME Certificate"),
                  const SizedBox(height: 12),
                  _buildDocumentSlot("Certificate of Vessel"),
                  const SizedBox(height: 12),
                  _buildDocumentSlot("Wildlife Certificate"),
                  const SizedBox(height: 12),
                  _buildDocumentSlot("Coxswain Certificate"),
                  const SizedBox(height: 12),
                  _buildDocumentSlot("Vessel Registration certificate"),
                ],
              ),
            ),
            
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity, height: 52,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFF0F172A), side: const BorderSide(color: Color(0xFF0F172A)), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                onPressed: () {},
                child: const Text("Save as Draft", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity, height: 52,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0F172A), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                onPressed: () {},
                child: const Text("Request Approval", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Padding(padding: const EdgeInsets.only(bottom: 8.0, top: 16.0), child: Text(text, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black87, fontSize: 13)));
  }

  Widget _buildTextField(String hint, {IconData? icon}) {
    return TextField(
      decoration: InputDecoration(
        hintText: hint, hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
        suffixIcon: icon != null ? Icon(icon, color: Colors.black87, size: 20) : null,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade200)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF152238))),
      ),
    );
  }

  Widget _buildDocumentSlot(String title, {bool uploaded = false, String? filename}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade200), borderRadius: BorderRadius.circular(8)),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black, fontSize: 13)),
                if (uploaded && filename != null) ...[
                  const SizedBox(height: 4),
                  Text(filename, style: TextStyle(color: Colors.grey.shade500, fontSize: 11)),
                ]
              ],
            ),
          ),
          Icon(uploaded ? Icons.delete_outline : Icons.upload_outlined, color: Colors.black87),
        ],
      ),
    );
  }
}