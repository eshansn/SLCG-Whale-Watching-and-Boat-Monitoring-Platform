import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart'; // Needed for iOS-style toggle switch
import '../../../widgets/owner_layout.dart';

class OwnerSettingsScreen extends StatefulWidget {
  const OwnerSettingsScreen({super.key});

  @override
  State<OwnerSettingsScreen> createState() => _OwnerSettingsScreenState();
}

class _OwnerSettingsScreenState extends State<OwnerSettingsScreen> {
  bool _notificationsEnabled = true;
  bool _autoUpdateEnabled = true;

  @override
  Widget build(BuildContext context) {
    return OwnerLayout(
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
        children: [
          _buildToggleSetting(
            title: "App Notifications",
            subtitle: "Receive mobile app notifications",
            value: _notificationsEnabled,
            onChanged: (val) => setState(() => _notificationsEnabled = val),
          ),
          const Divider(color: Colors.black12, height: 32),
          
          _buildToggleSetting(
            title: "Auto Updates",
            subtitle: "Automatically update when available",
            value: _autoUpdateEnabled,
            onChanged: (val) => setState(() => _autoUpdateEnabled = val),
          ),
          const Divider(color: Colors.black12, height: 32),

          _buildActionSetting(title: "Password", subtitle: "Update your password"),
          const Divider(color: Colors.black12, height: 32),

          _buildActionSetting(title: "Need Help?", subtitle: "Contact our support center"),
          const Divider(color: Colors.black12, height: 32),

          _buildTextSetting(title: "Log Out", subtitle: "Log Out From WWMS", isDestructive: true),
          const Divider(color: Colors.black12, height: 32),

          _buildTextSetting(title: "Delete My Account", subtitle: "Delete your WWMS account", isDestructive: true),
        ],
      ),
    );
  }

  Widget _buildToggleSetting({required String title, required String subtitle, required bool value, required ValueChanged<bool> onChanged}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 16, color: Colors.black87)),
            const SizedBox(height: 4),
            Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
          ],
        ),
        CupertinoSwitch(
          activeTrackColor: Colors.blue.shade600,
          value: value,
          onChanged: onChanged,
        ),
      ],
    );
  }

  Widget _buildActionSetting({required String title, required String subtitle}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 16, color: Colors.black87)),
            const SizedBox(height: 4),
            Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
          ],
        ),
        Icon(Icons.chevron_right, color: Colors.grey.shade400),
      ],
    );
  }

  Widget _buildTextSetting({required String title, required String subtitle, bool isDestructive = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title, 
          style: TextStyle(fontSize: 16, color: isDestructive ? Colors.red.shade400 : Colors.black87)
        ),
        const SizedBox(height: 4),
        Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
      ],
    );
  }
}