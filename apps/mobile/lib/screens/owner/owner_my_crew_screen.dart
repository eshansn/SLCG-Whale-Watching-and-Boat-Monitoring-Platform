import 'dart:async';

import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../widgets/owner_layout.dart';
import 'owner_portal_common.dart';

class OwnerMyCrewScreen extends StatefulWidget {
  const OwnerMyCrewScreen({super.key});

  @override
  State<OwnerMyCrewScreen> createState() => _OwnerMyCrewScreenState();
}

class _OwnerMyCrewScreenState extends State<OwnerMyCrewScreen> {
  final _api = ApiService.instance;
  final _email = TextEditingController();
  List<Map<String, dynamic>> _members = [];
  List<Map<String, dynamic>> _suggestions = [];
  Timer? _debounce;
  bool _loading = true;
  bool _searching = false;
  bool _adding = false;
  String? _error;
  String? _addError;

  @override
  void initState() {
    super.initState();
    _api.addListener(_operationsChanged);
    _load();
  }

  @override
  void dispose() {
    _api.removeListener(_operationsChanged);
    _debounce?.cancel();
    _email.dispose();
    super.dispose();
  }

  void _operationsChanged() => _load(silent: true);

  Future<void> _load({bool silent = false}) async {
    if (!silent && mounted) setState(() => _loading = true);
    try {
      final members = await _api.ownerCrew();
      members.sort((a, b) => '${a['name']}'.compareTo('${b['name']}'));
      if (!mounted) return;
      setState(() {
        _members = members;
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = ownerError(error);
        _loading = false;
      });
    }
  }

  void _searchCrew(String value) {
    _debounce?.cancel();
    final query = value.trim();
    setState(() {
      _addError = null;
      if (query.length < 2) _suggestions = [];
    });
    if (query.length < 2) return;
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      if (mounted) setState(() => _searching = true);
      try {
        final suggestions = await _api.searchOwnerCrew(query);
        if (!mounted || _email.text.trim() != query) return;
        setState(() {
          _suggestions = suggestions;
          _searching = false;
        });
      } catch (error) {
        if (!mounted) return;
        setState(() {
          _suggestions = [];
          _searching = false;
          _addError = ownerError(error);
        });
      }
    });
  }

  Future<void> _addMember() async {
    final email = _email.text.trim();
    if (email.isEmpty || _adding) {
      if (email.isEmpty) {
        setState(() => _addError = 'Enter a certified crew member email.');
      }
      return;
    }
    setState(() {
      _adding = true;
      _addError = null;
    });
    try {
      await _api.addOwnerCrew(email);
      _email.clear();
      _suggestions = [];
      await _load(silent: true);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Crew member added successfully.')));
      }
    } catch (error) {
      if (mounted) setState(() => _addError = ownerError(error));
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  void _goBack() {
    if (Navigator.canPop(context)) {
      Navigator.pop(context);
    } else {
      Navigator.pushReplacementNamed(context, '/boat_owner');
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xFFFAFBFD),
        appBar: AppBar(
          backgroundColor: Colors.white,
          foregroundColor: ownerInk,
          elevation: 0,
          centerTitle: true,
          leading: IconButton(
            tooltip: 'Back to dashboard',
            onPressed: _goBack,
            icon: const Icon(Icons.arrow_back_rounded, size: 20),
          ),
          title: const Text(
            'My Crew',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
          ),
        ),
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 36),
            children: [
              if (_error != null) ...[
                OwnerErrorPanel(message: _error!, retry: _load),
                const SizedBox(height: 12),
              ],
              _crewTable(),
              const SizedBox(height: 18),
              _addCrewPanel(),
            ],
          ),
        ),
      );

  Widget _crewTable() => Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(9),
          border: Border.all(color: const Color(0xFFE4E9F0)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0F000000),
              blurRadius: 10,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          children: [
            Container(
              color: const Color(0xFFF6F8FB),
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
              child: const Row(
                children: [
                  Expanded(flex: 5, child: _HeaderLabel('NAME')),
                  Expanded(flex: 4, child: _HeaderLabel('TYPE')),
                  Expanded(
                    flex: 3,
                    child: _HeaderLabel('ACTIONS', centered: true),
                  ),
                ],
              ),
            ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: CircularProgressIndicator(),
              )
            else if (_members.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 14, vertical: 30),
                child: Text(
                  'No crew members have been added yet.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: ownerMuted, fontSize: 12),
                ),
              )
            else
              ..._members.asMap().entries.map((entry) => Column(
                    children: [
                      _crewRow(entry.value),
                      if (entry.key < _members.length - 1)
                        const Divider(height: 1, color: Color(0xFFE7EBF0)),
                    ],
                  )),
          ],
        ),
      );

  Widget _crewRow(Map<String, dynamic> member) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 11),
        child: Row(
          children: [
            Expanded(
              flex: 5,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${member['name']}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: ownerInk,
                      fontSize: 10,
                      height: 1.15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    member['certified'] == true ? 'Certified' : 'Pending',
                    style: TextStyle(
                      color: member['certified'] == true
                          ? const Color(0xFF059669)
                          : const Color(0xFFD97706),
                      fontSize: 8,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              flex: 4,
              child: Text(
                '${member['position']}',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style:
                    const TextStyle(color: ownerInk, fontSize: 9, height: 1.2),
              ),
            ),
            Expanded(
              flex: 3,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  _compactAction(
                    tooltip: 'Crew details',
                    icon: Icons.info_outline_rounded,
                    color: ownerInk,
                    onPressed: () => _showDetails(member),
                  ),
                  _compactAction(
                    tooltip: 'Remove crew member',
                    icon: Icons.delete_outline_rounded,
                    color: const Color(0xFFF43F5E),
                    onPressed: () => _remove(member),
                  ),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _compactAction({
    required String tooltip,
    required IconData icon,
    required Color color,
    required VoidCallback onPressed,
  }) =>
      IconButton(
        tooltip: tooltip,
        visualDensity: VisualDensity.compact,
        constraints: const BoxConstraints.tightFor(width: 30, height: 30),
        padding: EdgeInsets.zero,
        onPressed: onPressed,
        color: color,
        icon: Icon(icon, size: 16),
      );

  Widget _addCrewPanel() => Container(
        padding: const EdgeInsets.all(17),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF062844), Color(0xFF0A3457)],
          ),
          borderRadius: BorderRadius.circular(14),
          boxShadow: const [
            BoxShadow(
                color: Color(0x30000000), blurRadius: 14, offset: Offset(0, 7)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.person_add_alt_1_outlined,
                    color: Colors.white, size: 20),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Add certified crew member',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const Padding(
              padding: EdgeInsets.only(left: 28, top: 2),
              child: Text(
                'The email must belong to a certified Boat Crew account.',
                style: TextStyle(color: Color(0xFFBFD3E7), fontSize: 9),
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              onChanged: _searchCrew,
              style: const TextStyle(fontSize: 12),
              decoration: InputDecoration(
                hintText: 'Enter certified crew member email',
                hintStyle:
                    const TextStyle(color: Color(0xFF94A3B8), fontSize: 10),
                fillColor: Colors.white,
                suffixIcon: _searching
                    ? const Padding(
                        padding: EdgeInsets.all(14),
                        child: SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : null,
              ),
            ),
            if (_suggestions.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(top: 6),
                constraints: const BoxConstraints(maxHeight: 150),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: ListView(
                  shrinkWrap: true,
                  padding: EdgeInsets.zero,
                  children: _suggestions
                      .map((suggestion) => ListTile(
                            dense: true,
                            title: Text('${suggestion['name']}',
                                style: const TextStyle(
                                    fontSize: 10, fontWeight: FontWeight.w600)),
                            subtitle: Text(
                                '${suggestion['email']} · ${suggestion['position']}',
                                style: const TextStyle(fontSize: 8)),
                            onTap: () => setState(() {
                              _email.text = '${suggestion['email']}';
                              _suggestions = [];
                              _addError = null;
                            }),
                          ))
                      .toList(),
                ),
              ),
            if (_addError != null) ...[
              const SizedBox(height: 8),
              Text(_addError!,
                  style:
                      const TextStyle(color: Color(0xFFFFC2CB), fontSize: 10)),
            ],
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 40,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFF062844),
                ),
                onPressed: _adding ? null : _addMember,
                icon: _adding
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.person_add_alt_1_outlined, size: 16),
                label: Text(_adding ? 'Adding…' : 'Add Member',
                    style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      );

  void _showDetails(Map<String, dynamic> member) => showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('${member['name']}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _detail('Email', member['email']),
              _detail('Phone', member['phoneNumber'] ?? 'Not provided'),
              _detail('Position', member['position']),
              _detail('Certification',
                  member['certified'] == true ? 'Certified' : 'Pending'),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Close')),
          ],
        ),
      );

  Widget _detail(String label, Object? value) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: const TextStyle(
                    color: ownerMuted,
                    fontSize: 12,
                    fontWeight: FontWeight.w600)),
            Text('$value'),
          ],
        ),
      );

  Future<void> _remove(Map<String, dynamic> member) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Remove crew member?'),
            content: Text(
                '${member['name']} will be removed from your crew pool. Existing trip assignments are not changed.'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Cancel')),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: Colors.red),
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Remove'),
              ),
            ],
          ),
        ) ??
        false;
    if (!confirmed) return;
    try {
      await _api.removeOwnerCrew('${member['assignmentId']}');
      await _load(silent: true);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Crew member removed.')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(ownerError(error))));
      }
    }
  }
}

class _HeaderLabel extends StatelessWidget {
  final String text;
  final bool centered;

  const _HeaderLabel(this.text, {this.centered = false});

  @override
  Widget build(BuildContext context) => Text(
        text,
        textAlign: centered ? TextAlign.center : TextAlign.left,
        style: const TextStyle(
          color: Color(0xFF64748B),
          fontSize: 8,
          fontWeight: FontWeight.w700,
          letterSpacing: .25,
        ),
      );
}
