import 'package:flutter/material.dart';
import '../../widgets/shared_widgets.dart';
import '../../services/api_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _isLoggingIn = false;

  Future<void> _handleLogin() async {
    final username = _usernameController.text.trim();
    final password = _passwordController.text;

    if (username.isEmpty || password.isEmpty || _isLoggingIn) return;
    setState(() => _isLoggingIn = true);

    try {
      final role=await ApiService.instance.login(username,password);
      if(!mounted)return;
      final route=switch(role){'ShoreCrew'=>'/shore_dashboard','BoatOwner'=>'/boat_owner','BoatCrew'=>'/boat_crew',_=>null};
      if (route == null) {
        await ApiService.instance.logout();
        throw Exception('$role accounts use the web portal. Flutter supports Shore Crew, Boat Owner, and Boat Crew accounts.');
      }
      Navigator.pushNamedAndRemoveUntil(context,route,(_)=>false);
    } catch (error) {
      if(!mounted)return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString().replaceFirst('Exception: ','')), backgroundColor: Colors.redAccent),
      );
    } finally {
      if (mounted) setState(() => _isLoggingIn = false);
    }
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScreenBackground(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("Welcome Back!", style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Text("Continue Where You Left Off With Secure Account Access.", style: TextStyle(fontSize: 14, color: Colors.white70)),
          const SizedBox(height: 32),
          CustomTextField(hintText: "Enter email or user name", controller: _usernameController),
          CustomTextField(hintText: "Password", isPassword: true, controller: _passwordController),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () {},
              child: const Text("Forgot password?", style: TextStyle(color: Colors.white54)),
            ),
          ),
          const SizedBox(height: 16),
          CyanButton(text: _isLoggingIn ? "Connecting..." : "Log In", onPressed: () => _handleLogin()),
          const SizedBox(height: 16),
          Center(
            child: GestureDetector(
              onTap: () => Navigator.pushReplacementNamed(context, '/signup_step1'),
              child: RichText(
                text: const TextSpan(
                  text: "Don't have an account? ",
                  style: TextStyle(color: Colors.white54),
                  children: [TextSpan(text: "Sign Up", style: TextStyle(color: Color(0xFF6FFFE9)))],
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
