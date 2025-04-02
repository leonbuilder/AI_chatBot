from tortoise import fields
from tortoise.models import Model

class User(Model):
    id = fields.IntField(pk=True)
    username = fields.CharField(max_length=20, unique=True)
    hashed_password = fields.CharField(max_length=128)
    email = fields.CharField(max_length=128, null=True)
    full_name = fields.CharField(max_length=128, null=True)
    is_active = fields.BooleanField(default=True)
    is_superuser = fields.BooleanField(default=False)
    created_at = fields.DatetimeField(auto_now_add=True)
    
    def __str__(self):
        return self.username
    
    class Meta:
        table = "users"

class Session(Model):
    id = fields.IntField(pk=True)
    session_id = fields.CharField(max_length=36, unique=True)
    user_id = fields.IntField()
    title = fields.CharField(max_length=128, default="New Chat")
    purpose = fields.CharField(max_length=128, null=True)
    system_prompt = fields.TextField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)
    
    def __str__(self):
        return f"Session {self.id} - {self.title}"
    
    class Meta:
        table = "sessions"

class Message(Model):
    id = fields.IntField(pk=True)
    session_id = fields.CharField(max_length=36)
    user_id = fields.IntField()
    role = fields.CharField(max_length=20)  # 'user' or 'assistant'
    content = fields.TextField()
    created_at = fields.DatetimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Message {self.id} - {self.role}"
    
    class Meta:
        table = "messages"

class ImprovementFeedback(Model):
    id = fields.IntField(pk=True)
    user_id = fields.IntField()
    improvement_id = fields.CharField(max_length=36)  # To track specific improvements
    original_prompt = fields.TextField()
    improved_prompt = fields.TextField()
    is_positive = fields.BooleanField()  # Thumbs up (true) or down (false)
    style = fields.CharField(max_length=20, null=True)  # balanced, concise, detailed, etc.
    domain = fields.CharField(max_length=20, null=True)  # business, technical, etc.
    strength = fields.FloatField(default=0.5)  # Improvement strength (0.1-0.9)
    created_at = fields.DatetimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Feedback {self.id} - {'Positive' if self.is_positive else 'Negative'}"
    
    class Meta:
        table = "improvement_feedback" 