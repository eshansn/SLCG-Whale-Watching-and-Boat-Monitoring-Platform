import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../widgets/owner_layout.dart';
import 'owner_portal_common.dart';

class OwnerBoatsScreen extends StatefulWidget {
  const OwnerBoatsScreen({super.key});

  @override
  State<OwnerBoatsScreen> createState() => _OwnerBoatsScreenState();
}

class _OwnerBoatsScreenState extends State<OwnerBoatsScreen> {
  final _api = ApiService.instance;
  List<Map<String, dynamic>> _boats = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _api.addListener(_realtimeRefresh);
    _load();
  }

  @override
  void dispose() {
    _api.removeListener(_realtimeRefresh);
    super.dispose();
  }

  void _realtimeRefresh() => _load(silent: true);

  Future<void> _load({bool silent = false}) async {
    if (!silent && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final boats = await _api.boats();
      if (!mounted) return;
      setState(() {
        _boats = boats;
        _loading = false;
        _error = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        if (!silent) _error = ownerError(error);
      });
    }
  }

  Future<void> _open(String route, {Object? arguments}) async {
    await Navigator.pushNamed(context, route, arguments: arguments);
    await _load(silent: true);
  }

  @override
  Widget build(BuildContext context) {
    final approved = _boats
        .where((boat) => boat['approval']?.toString() == 'Approved')
        .toList();
    final awaiting = _boats
        .where((boat) => boat['approval']?.toString() != 'Approved')
        .toList();
    return OwnerLayout(
      active: 'boats',
      title: 'My Boats',
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 40),
          children: [
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 90),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              OwnerErrorPanel(message: _error!, retry: _load)
            else ...[
              const Text('Approved Boats',
                  style: TextStyle(fontSize: 19, fontWeight: FontWeight.w600)),
              const SizedBox(height: 12),
              if (approved.isEmpty)
                const Text('No boats have completed approval yet.',
                    style: TextStyle(color: ownerMuted))
              else
                _boatGrid(approved),
              const SizedBox(height: 26),
              const Text('Yet to be Approved',
                  style: TextStyle(fontSize: 19, fontWeight: FontWeight.w600)),
              const SizedBox(height: 12),
              if (awaiting.isEmpty)
                const Text('No boats are awaiting approval.',
                    style: TextStyle(color: ownerMuted))
              else
                _boatGrid(awaiting),
              const SizedBox(height: 26),
              OwnerEmptyPanel(
                title: 'Register New Boats',
                message: "Initialize your boat's digital profile.",
                actionLabel: 'Register Boat',
                icon: Icons.add_circle_outline_rounded,
                onAction: () => _open('/owner_new_boat'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _boatGrid(List<Map<String, dynamic>> boats) => LayoutBuilder(
        builder: (context, constraints) {
          final columns = constraints.maxWidth >= 900
              ? 3
              : constraints.maxWidth >= 600
                  ? 2
                  : 1;
          final width = (constraints.maxWidth - (columns - 1) * 14) / columns;
          return Wrap(
            spacing: 14,
            runSpacing: 14,
            children: boats
                .map((boat) => SizedBox(width: width, child: _boatCard(boat)))
                .toList(),
          );
        },
      );

  Widget _boatCard(Map<String, dynamic> boat) => OwnerCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Name',
                          style: TextStyle(fontWeight: FontWeight.w600)),
                      Text(boat['name']?.toString() ?? 'Unnamed vessel'),
                      const SizedBox(height: 10),
                      const Text('Reg No',
                          style: TextStyle(fontWeight: FontWeight.w600)),
                      Text(boat['registrationNumber']?.toString() ?? ''),
                      const SizedBox(height: 10),
                      OwnerStatusBadge(
                        boat['approval'],
                        label: boat['approval']?.toString() == 'Rejected'
                            ? 'Approval declined'
                            : boat['approval']?.toString() == 'Approved'
                                ? 'Approved'
                                : 'Approval pending',
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(child: OwnerBoatImage(boat['imageUrl'], height: 135)),
              ],
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => _open('/owner_boat_info',
                    arguments: boat['id']?.toString()),
                icon: const Icon(Icons.info_outline_rounded, size: 18),
                label: const Text('Info'),
              ),
            ),
          ],
        ),
      );
}
