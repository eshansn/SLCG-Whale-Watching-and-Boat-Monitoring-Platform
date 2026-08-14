import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import 'app_typography.dart';

const shoreInk = Color(0xFF14223D);
const shoreBackground = Color(0xFFF8F9FB);
const shoreMuted = Color(0xFF94A3B8);
const shoreIndigo = Color(0xFF4F46E5);

String formatShoreDate(Object? value) {
  final parsed = DateTime.tryParse(value?.toString() ?? '');
  return parsed == null
      ? 'TBA'
      : DateFormat('MMM d, y, h:mm a').format(parsed.toLocal());
}

enum ShorePortal { slcg, wildlife }

class ShoreLayout extends StatelessWidget {
  final Widget child;
  final String active;
  final ShorePortal portal;
  const ShoreLayout({
    super.key,
    required this.child,
    this.active = 'home',
    this.portal = ShorePortal.slcg,
  });

  bool get _isWildlife => portal == ShorePortal.wildlife;
  String get _homeRoute => _isWildlife ? '/shore_wildlife' : '/shore_dashboard';
  String get _tripsRoute => _isWildlife ? '/shore_wildlife' : '/trips_list';

  @override
  Widget build(BuildContext context) => Theme(
        data: withWebsitePoppins(Theme.of(context)).copyWith(
          scaffoldBackgroundColor: shoreBackground,
          colorScheme: ColorScheme.fromSeed(seedColor: shoreIndigo),
          textTheme: withWebsitePoppins(Theme.of(context)).textTheme.apply(
                bodyColor: shoreInk,
                displayColor: shoreInk,
              ),
        ),
        child: Scaffold(
          backgroundColor:
              _isWildlife ? const Color(0xFFF4F8F6) : shoreBackground,
          drawer:
              MediaQuery.sizeOf(context).width < 1100 ? _drawer(context) : null,
          body: Container(
            decoration: _isWildlife
                ? const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Color(0xFFF8FBFA), Color(0xFFF1F7F4)],
                    ),
                  )
                : null,
            child: SafeArea(
              top: true,
              bottom: true,
              child: Column(children: [
                Builder(builder: (navContext) => _navbar(navContext)),
                Expanded(child: child),
              ]),
            ),
          ),
        ),
      );

  Widget _navbar(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 1100;
    return Container(
      height: _isWildlife ? 72 : 64,
      padding: EdgeInsets.symmetric(horizontal: wide ? 32 : 16),
      decoration: BoxDecoration(
          color: _isWildlife ? const Color(0xFAFFFFFF) : Colors.white,
          border: Border(
              bottom: BorderSide(
                  color: _isWildlife
                      ? const Color(0xFFDDE9E4)
                      : const Color(0xFFE2E8F0))),
          boxShadow: const [
            BoxShadow(
                color: Color(0x0D0F172A), blurRadius: 10, offset: Offset(0, 2))
          ]),
      child: Row(children: [
        InkWell(
            onTap: () => Navigator.pushNamedAndRemoveUntil(
                context, _homeRoute, (_) => false),
            child: _brand()),
        const Spacer(),
        if (wide) ...[
          if (_isWildlife) ...[
            _navLink(context, 'Trips', '/shore_wildlife', 'trips',
                Icons.directions_boat_outlined),
            const SizedBox(width: 14),
            _navLink(context, 'Records', '/shore_wildlife_records', 'records',
                Icons.assignment_outlined),
            const SizedBox(width: 14),
            _navLink(context, 'Settings', '/shore_wildlife_settings',
                'settings', Icons.settings_outlined),
          ] else ...[
            _iconLink(context, Icons.notifications_none, '/shore_notifications',
                'notifications'),
            const SizedBox(width: 14),
            _navLink(
                context,
                active == 'trips' ? 'Dashboard' : 'Trips',
                active == 'trips' ? _homeRoute : _tripsRoute,
                active == 'trips' ? 'home' : 'trips',
                active == 'trips'
                    ? Icons.home_outlined
                    : Icons.directions_boat_outlined),
            const SizedBox(width: 14),
            _navLink(context, 'Settings', '/shore_settings', 'settings',
                Icons.settings_outlined),
          ],
          const SizedBox(width: 14),
          ElevatedButton(
              onPressed: () => _logout(context),
              style: ElevatedButton.styleFrom(
                  backgroundColor: shoreInk,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  shape: _isWildlife
                      ? RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(6))
                      : const StadiumBorder()),
              child: const Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.logout, size: 18),
                SizedBox(width: 8),
                Text('Log out', style: TextStyle(fontWeight: FontWeight.w600))
              ])),
        ] else
          Row(mainAxisSize: MainAxisSize.min, children: [
            if (!_isWildlife)
              _iconLink(context, Icons.notifications_none,
                  '/shore_notifications', 'notifications'),
            IconButton(
                tooltip: 'Toggle navigation',
                onPressed: () => Scaffold.of(context).openDrawer(),
                icon: const Icon(Icons.menu, color: shoreInk))
          ]),
      ]),
    );
  }

  Widget _brand() => _isWildlife
      ? Image.asset('assets/images/wildlife_authority.png',
          height: 46,
          errorBuilder: (_, __, ___) =>
              const Icon(Icons.eco_outlined, color: shoreInk, size: 34))
      : Image.asset('assets/images/slcg_logo.png',
          height: 34,
          errorBuilder: (_, __, ___) =>
              const Icon(Icons.anchor, color: shoreInk, size: 34));

  Widget _navLink(BuildContext context, String label, String route, String key,
          IconData icon) =>
      TextButton(
          onPressed: () => Navigator.pushNamed(context, route),
          style: TextButton.styleFrom(
              foregroundColor:
                  active == key ? shoreInk : const Color(0xFF64748B),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
              shape: _isWildlife
                  ? RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(6))
                  : const StadiumBorder()),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 18),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(fontWeight: FontWeight.w500))
          ]));
  Widget _iconLink(
          BuildContext context, IconData icon, String route, String key) =>
      IconButton(
          onPressed: () => Navigator.pushNamed(context, route),
          icon: Icon(icon,
              color: active == key ? shoreInk : const Color(0xFF64748B),
              size: 21));

  Drawer _drawer(BuildContext context) => Drawer(
      width: _isWildlife ? 310 : null,
      backgroundColor: _isWildlife ? const Color(0xFFF8FBFA) : null,
      surfaceTintColor: _isWildlife ? Colors.transparent : null,
      child: SafeArea(
          child: ListView(padding: const EdgeInsets.all(16), children: [
        Container(
          padding: EdgeInsets.all(_isWildlife ? 12 : 0),
          decoration: _isWildlife
              ? BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE3ECE8)),
                )
              : null,
          child: Align(alignment: Alignment.centerLeft, child: _brand()),
        ),
        const Divider(height: 36),
        if (_isWildlife) ...[
          ListTile(
              leading: const Icon(Icons.directions_boat_outlined),
              title: const Text('Trips'),
              selected: active == 'trips',
              selectedColor: const Color(0xFF16866A),
              selectedTileColor: const Color(0xFFE8F6F1),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              onTap: () => Navigator.pushNamed(context, _tripsRoute)),
          ListTile(
              leading: const Icon(Icons.assignment_outlined),
              title: const Text('Records'),
              selected: active == 'records',
              selectedColor: const Color(0xFF16866A),
              selectedTileColor: const Color(0xFFE8F6F1),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              onTap: () =>
                  Navigator.pushNamed(context, '/shore_wildlife_records')),
          ListTile(
              leading: const Icon(Icons.settings_outlined),
              title: const Text('Settings'),
              selected: active == 'settings',
              selectedColor: const Color(0xFF16866A),
              selectedTileColor: const Color(0xFFE8F6F1),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              onTap: () =>
                  Navigator.pushNamed(context, '/shore_wildlife_settings')),
        ] else ...[
          ListTile(
              leading: const Icon(Icons.home_outlined),
              title: const Text('Dashboard'),
              selected: active == 'home',
              onTap: () => Navigator.pushNamedAndRemoveUntil(
                  context, _homeRoute, (_) => false)),
          ListTile(
              leading: const Icon(Icons.directions_boat_outlined),
              title: const Text('Trips'),
              selected: active == 'trips',
              onTap: () => Navigator.pushNamed(context, _tripsRoute)),
          ListTile(
              leading: const Icon(Icons.notifications_none),
              title: const Text('Notifications'),
              onTap: () =>
                  Navigator.pushNamed(context, '/shore_notifications')),
          ListTile(
              leading: const Icon(Icons.settings_outlined),
              title: const Text('Settings'),
              onTap: () => Navigator.pushNamed(context, '/shore_settings')),
        ],
        const Divider(),
        ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Log Out', style: TextStyle(color: Colors.red)),
            onTap: () => _logout(context)),
      ])));

  Future<void> _logout(BuildContext context) async {
    await ApiService.instance.logout();
    if (context.mounted)
      Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
  }
}
