import 'package:flutter/material.dart';

class OwnerDrawer extends StatelessWidget {
  const OwnerDrawer({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: MediaQuery.of(context).size.width * 0.45,
      child: Drawer(
        backgroundColor: Colors.white,
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Align(
                alignment: Alignment.topRight,
                child: IconButton(
                  icon: const Icon(Icons.close, color: Colors.black, size: 28),
                  onPressed: () => Navigator.pop(context),
                ),
              ),
              const SizedBox(height: 32),
              _buildDrawerItem(context, Icons.dashboard_outlined, 'Dashboard', '/boat_owner'),
              _buildDrawerItem(context, Icons.notifications_outlined, 'Notifications', '/owner_notifications'),
              _buildDrawerItem(context, Icons.person_outline, 'Profile', '/owner_profile'),
              _buildDrawerItem(context, Icons.people_outline, 'My Crew', '/owner_my_crew'),
              _buildDrawerItem(context, Icons.directions_boat_outlined, 'My Boats', '/owner_boats'),
              _buildDrawerItem(context, Icons.info_outline, 'My Trips', '/owner_trips'),
              _buildDrawerItem(context, Icons.settings_outlined, 'Settings', '/owner_settings'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDrawerItem(BuildContext context, IconData icon, String title, String route) {
    return InkWell(
      onTap: () {
        Navigator.pop(context);
        if (route.isNotEmpty) {
          if (ModalRoute.of(context)?.settings.name != route) {
            Navigator.pushNamed(context, route);
          }
        }
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 20.0, horizontal: 24.0),
        child: Row(
          children: [
            Icon(icon, color: Colors.black87, size: 24),
            const SizedBox(width: 16),
            Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.black87)),
          ],
        ),
      ),
    );
  }
}

class OwnerLayout extends StatelessWidget {
  final Widget child;
  final String? title;

  const OwnerLayout({Key? key, required this.child, this.title}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Color(0xFF152238)),
        leading: IconButton(
          icon: const Icon(Icons.notifications_none, size: 28),
          onPressed: () => Navigator.pushNamed(context, '/owner_notifications'),
        ),
        title: title != null 
            ? Text(title!, style: const TextStyle(color: Color(0xFF152238), fontWeight: FontWeight.bold, fontSize: 18))
            : null,
        centerTitle: true,
        actions: [
          Builder(
            builder: (context) => IconButton(
              icon: const Icon(Icons.menu, size: 32),
              onPressed: () => Scaffold.of(context).openEndDrawer(),
            ),
          ),
        ],
      ),
      endDrawer: const OwnerDrawer(),
      body: child,
    );
  }
}
